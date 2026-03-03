import { Result, CompileError, ok } from "../types";
import {
  stripNumericTypeSuffixes,
  stripTypeAnnotations,
  transformComparisonOperators,
  transformReadPatterns,
  transformMethodCalls,
} from "../transformations/transformations";
import {
  findMatchingParen,
  findMatchingBrace,
  findLastDepthZeroChar,
  extractParamNames,
} from "./compilation-fn-helpers";

function buildFnIife(
  fnName: string,
  paramNames: string,
  bodyStatements: string,
  bodyReturn: string,
  callExpr: string,
): string {
  const stmts = bodyStatements !== "" ? `${bodyStatements} ` : "";
  return `(function() { function ${fnName}(${paramNames}) { ${stmts}return ${bodyReturn}; } return ${callExpr}; })()`;
}

function findLastDepthZeroSemicolon(content: string): number {
  return findLastDepthZeroChar(content, ";");
}

function renameThisParameter(source: string): string {
  // Replace standalone 'this' with '_this' (at word boundaries)
  let result = "";
  let i = 0;
  while (i < source.length) {
    const isThisWord =
      i + 4 <= source.length &&
      source.substring(i, i + 4) === "this" &&
      (i === 0 || !isAlphaNumeric(source[i - 1])) &&
      (i + 4 === source.length || !isAlphaNumeric(source[i + 4]));

    if (isThisWord) {
      result += "_this";
      i += 4;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

function isAlphaNumeric(char: string): boolean {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    (char >= "0" && char <= "9") ||
    char === "_"
  );
}

function compileFnStatement(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith("fn ")) return null;

  // Find the function's parameter list first
  const openParen = trimmed.indexOf("(", 3);
  if (openParen === -1) return null;
  const closeParen = findMatchingParen(trimmed, openParen);
  if (closeParen === -1) return null;

  // Find the => belonging to THIS function (after the closing paren, skipping type annotations)
  const arrowIdx = trimmed.indexOf("=>", closeParen + 1);
  if (arrowIdx === -1) return null;

  let body: string;
  let after: string;

  // Skip whitespace after => to check if body is a block
  let bodyStart = arrowIdx + 2;
  while (
    bodyStart < trimmed.length &&
    (trimmed[bodyStart] === " " ||
      trimmed[bodyStart] === "\n" ||
      trimmed[bodyStart] === "\r" ||
      trimmed[bodyStart] === "\t")
  ) {
    bodyStart++;
  }

  if (trimmed[bodyStart] === "{") {
    // Block body: ends at matching }
    const braceEnd = findMatchingBrace(trimmed, bodyStart);
    if (braceEnd === -1) return null;
    body = trimmed.substring(bodyStart + 1, braceEnd).trim();
    after = trimmed.substring(braceEnd + 1).trim();
  } else {
    // Expression body: ends at ;
    const semiIdx = trimmed.indexOf(";", arrowIdx + 2);
    if (semiIdx === -1) return null;
    body = trimmed.substring(arrowIdx + 2, semiIdx).trim();
    after = trimmed.substring(semiIdx + 1).trim();
  }

  const fnNameRaw = trimmed.substring(3, openParen).trim();
  const fnName = stripTypeAnnotations(fnNameRaw);
  const paramsRaw = trimmed.substring(openParen + 1, closeParen);
  const paramNames = extractParamNames(paramsRaw);

  // Rename 'this' to '_this' in the body since 'this' is a reserved keyword
  const bodyWithRenamedThis = renameThisParameter(body);

  const transformedFullBody = stripNumericTypeSuffixes(
    transformComparisonOperators(
      transformMethodCalls(transformReadPatterns(bodyWithRenamedThis)),
    ),
  );

  // Split block body into statements + return expression
  const lastSemi = findLastDepthZeroSemicolon(transformedFullBody);
  let bodyStatements: string;
  let bodyReturn: string;
  if (lastSemi === -1) {
    bodyStatements = "";
    bodyReturn = transformedFullBody;
  } else {
    bodyStatements = transformedFullBody.substring(0, lastSemi + 1).trim();
    bodyReturn = transformedFullBody.substring(lastSemi + 1).trim();
    if (bodyReturn === "") {
      bodyReturn = "0";
    }
  }

  const afterExpr = stripNumericTypeSuffixes(
    transformComparisonOperators(
      transformMethodCalls(
        stripTypeAnnotations(transformReadPatterns(renameThisParameter(after))),
      ),
    ),
  );
  let callExpr = afterExpr;
  if (callExpr === "") callExpr = "0";
  return ok(
    buildFnIife(fnName, paramNames, bodyStatements, bodyReturn, callExpr),
  );
}

export { compileFnStatement };
