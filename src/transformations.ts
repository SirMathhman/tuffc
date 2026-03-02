import {
  extractIdentifier,
  isAlpha,
  isDigit,
  findBlockEnd,
  forEachAddressOf,
  extractBlockContent,
  isAssignmentOperator,
} from "./extractors";
import { parseBlockStatements, getLastStatement } from "./metadata";
import { DereferenceAssignment } from "./types";

function skipTypeAnnotation(source: string, i: number): number {
  if (i < source.length - 1 && source[i] === ":" && source[i + 1] === " ") {
    let j = i + 2;
    while (j < source.length) {
      const char = source[j];
      const isTypePart =
        isAlpha(char) ||
        isDigit(char) ||
        char === "<" ||
        char === ">" ||
        char === "," ||
        char === "*";
      const isSpace =
        char === " " && j + 1 < source.length && isAlpha(source[j + 1]);
      if (isTypePart || isSpace) {
        j++;
      } else {
        break;
      }
    }
    while (j < source.length && source[j] === " ") {
      j++;
    }
    return j;
  }
  return i;
}

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 5 && source.substring(i, i + 8) === "let mut ") {
      result += "let ";
      i += 8;
    } else {
      const newI = skipTypeAnnotation(source, i);
      if (newI > i) {
        i = newI;
      } else {
        const suffix = (() => {
          const isNumber =
            isDigit(source[i]) ||
            (source[i] === "-" &&
              i + 1 < source.length &&
              isDigit(source[i + 1]));
          if (!isNumber) {
            return { newIndex: i, result: "" };
          }
          let j = i;
          if (source[j] === "-") j++;
          while (j < source.length && isDigit(source[j])) {
            j++;
          }
          const numericPart = source.substring(i, j);
          let suffixEnd = j;
          while (suffixEnd < source.length && isAlpha(source[suffixEnd])) {
            suffixEnd++;
          }
          return { newIndex: suffixEnd, result: numericPart };
        })();
        if (suffix.newIndex > i) {
          result += suffix.result;
          i = suffix.newIndex;
        } else {
          result += source[i];
          i++;
        }
      }
    }
  }
  return result;
}

function transformReadPatterns(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    let consumed = 1;
    if (source.substring(i, i + 5) === "read<") {
      let j = i + 5;
      while (j < source.length && source[j] !== ">") {
        j++;
      }
      if (source[j] === ">" && source[j + 1] === "(" && source[j + 2] === ")") {
        result += "read()";
        consumed = j + 3 - i;
      }
    }
    if (consumed === 1) {
      result += source[i];
    }
    i += consumed;
  }
  return result;
}

function stripNumericTypeSuffixes(code: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (isDigit(char)) {
      let j = i;
      while (j < code.length && isDigit(code[j])) {
        j++;
      }
      result += code.substring(i, j);

      let suffixEnd = j;
      while (suffixEnd < code.length && isAlpha(code[suffixEnd])) {
        suffixEnd++;
      }

      i = suffixEnd;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

function identifierAfterDeref(source: string, pos: number): string {
  return extractIdentifier(source, pos + 1);
}

function transformAddressOf(source: string): string {
  let result = "";
  let lastEnd = 0;

  forEachAddressOf(source, (varName, isMut, position, varEnd) => {
    result += source.substring(lastEnd, position);
    if (isMut) {
      result += `{get:()=>${varName},set:(v)=>{${varName}=v}}`;
    } else {
      result += `{get:()=>${varName}}`;
    }
    lastEnd = varEnd;
  });

  result += source.substring(lastEnd);
  return result;
}

function findDereferenceAssignments(source: string): DereferenceAssignment[] {
  const assignments: DereferenceAssignment[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      const varName = identifierAfterDeref(source, i);
      if (varName !== "") {
        const afterVar = i + 1 + varName.length;
        if (isAssignmentOperator(source, afterVar)) {
          let exprEnd = afterVar + 3;
          while (exprEnd < source.length && source[exprEnd] !== ";") {
            exprEnd++;
          }
          assignments.push({
            varName,
            position: i,
            exprStart: afterVar + 3,
            exprEnd,
          });
        }
      }
    }
    i++;
  }
  return assignments;
}

function transformDereference(source: string): string {
  let result = "";
  let lastEnd = 0;
  const assignments = findDereferenceAssignments(source);
  const assignmentSet = new Set(assignments.map((a) => a.position));

  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      result += source.substring(lastEnd, i);
      if (assignmentSet.has(i)) {
        const assignment = assignments.find((a) => a.position === i)!;
        result += `${assignment.varName}.set(${source.substring(assignment.exprStart, assignment.exprEnd)})`;
        lastEnd = assignment.exprEnd;
        i = assignment.exprEnd;
      } else {
        const varName = identifierAfterDeref(source, i);
        if (varName !== "") {
          result += `${varName}.get()`;
          lastEnd = i + 1 + varName.length;
          i = lastEnd;
        } else {
          result += source[i];
          lastEnd = i + 1;
          i++;
        }
      }
    } else {
      i++;
    }
  }
  result += source.substring(lastEnd);
  return result;
}

function wrapBlockExpressionInInit(source: string): string {
  if (source.indexOf("let ") === -1 || source.indexOf("=") === -1) {
    return source;
  }

  const eqIndex = source.indexOf("=");
  const beforeEq = source.substring(0, eqIndex).trim();
  const afterEq = source.substring(eqIndex + 1).trim();

  if (!afterEq.startsWith("{")) {
    return source;
  }

  const blockEnd = findBlockEnd(afterEq);
  if (blockEnd === -1) {
    return source;
  }

  const afterBlock = afterEq.substring(blockEnd + 1);

  const blockContent = extractBlockContent(afterEq, blockEnd);
  const stmts = parseBlockStatements(blockContent);

  if (stmts.length > 0) {
    const lastStmt = getLastStatement(stmts);
    if (!lastStmt.startsWith("let ")) {
      const beforeLastStmts = stmts.slice(0, -1).join("; ");
      let beforeLastPart = "";
      if (beforeLastStmts !== "") {
        beforeLastPart = beforeLastStmts + "; ";
      }
      const newBlock = `{ ${beforeLastPart} return ${lastStmt}; }`;
      return beforeEq + " = (function() " + newBlock + ")()" + afterBlock;
    }
  }

  return source;
}

export {
  skipTypeAnnotation,
  stripTypeAnnotations,
  transformReadPatterns,
  stripNumericTypeSuffixes,
  transformAddressOf,
  transformDereference,
  wrapBlockExpressionInInit,
};
