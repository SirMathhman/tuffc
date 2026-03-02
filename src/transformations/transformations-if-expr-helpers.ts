import {
  findExpressionEnd,
  skipWhitespace,
  extractCondition,
} from "./transformations-if-expr-utils";

function transformIfElseExpression(expr: string): string {
  const trimmed = expr.trim();
  if (
    !(trimmed.startsWith("if ") || trimmed.startsWith("if(")) ||
    trimmed.indexOf("else") === -1
  ) {
    return expr;
  }

  const ifIdx = trimmed.indexOf("if");
  const { cond, endIdx } = extractCondition(trimmed, ifIdx);
  if (!cond) return expr;

  let i = skipWhitespace(trimmed, endIdx);
  const thenStart = i;
  const elseIdx = trimmed.indexOf("else", i);
  if (elseIdx === -1) return expr;

  const thenVal = trimmed.substring(thenStart, elseIdx).trim();
  i = elseIdx + 4;
  i = skipWhitespace(trimmed, i);
  const elseVal = trimmed.substring(i).trim();

  return `(function() { if (${cond}) return ${thenVal}; else return ${elseVal}; })()`;
}

function transformAssignmentWithIfExpr(
  source: string,
  eqIdx: number,
): { result: string; nextIdx: number } | null {
  if (eqIdx + 3 > source.length) {
    return null;
  }

  const hasSpace = source.substring(eqIdx + 1, eqIdx + 4) === " if";
  const noSpace = source.substring(eqIdx + 1, eqIdx + 3) === "if";

  if (!hasSpace && !noSpace) {
    return null;
  }

  let i = eqIdx + 1;
  i = skipWhitespace(source, i);
  const exprStart = i;

  const { endIdx, foundElse } = findExpressionEnd(source, i);
  const expression = source.substring(exprStart, endIdx).trim();

  if (!foundElse || expression.includes("{")) {
    return null;
  }

  const transformed = transformIfElseExpression(expression);
  let wsIdx = eqIdx + 1;
  wsIdx = skipWhitespace(source, wsIdx);

  return {
    result: "=" + source.substring(eqIdx + 1, wsIdx) + transformed,
    nextIdx: endIdx,
  };
}

function transformIfElseToTernary(source: string): string {
  if (source.indexOf("= if") === -1 && source.indexOf("=if") === -1) {
    return source;
  }

  let result = "";
  let i = 0;

  while (i < source.length) {
    if (source[i] === "=") {
      const transformed = transformAssignmentWithIfExpr(source, i);
      if (transformed !== null) {
        result += transformed.result;
        i = transformed.nextIdx;
      } else {
        result += source[i];
        i++;
      }
    } else {
      result += source[i];
      i++;
    }
  }

  return result;
}

export { transformIfElseToTernary };
