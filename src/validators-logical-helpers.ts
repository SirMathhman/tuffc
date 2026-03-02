/* eslint-disable max-lines */
import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "./types";
import { extractIdentifier } from "./extractors";
import { findVariable } from "./metadata";

function getExpressionType(expr: string, metadata: VariableInfo[]): string {
  const trimmed = expr.trim();
  if (trimmed === "true" || trimmed === "false") {
    return "Bool";
  }
  const firstChar = trimmed[0];
  if (firstChar >= "a" && firstChar <= "z") {
    const identifier = extractIdentifier(trimmed, 0);
    if (identifier !== "" && identifier === trimmed) {
      const varInfo = findVariable(identifier, metadata);
      if (varInfo !== undefined) {
        return varInfo.inferredType;
      }
    }
  }
  return "";
}

function extractOperands(
  source: string,
  opIndex: number,
): { leftExpr: string; rightExpr: string } | null {
  let leftEnd = opIndex - 1;
  while (leftEnd >= 0 && source[leftEnd] === " ") {
    leftEnd--;
  }
  if (leftEnd < 0) {
    return null;
  }
  let leftStart = leftEnd;
  while (
    leftStart >= 0 &&
    source[leftStart] !== " " &&
    source[leftStart] !== ";" &&
    source[leftStart] !== "{" &&
    source[leftStart] !== "("
  ) {
    leftStart--;
  }
  leftStart++;
  const leftExpr = source.substring(leftStart, leftEnd + 1).trim();
  let rightStart = opIndex + 2;
  while (rightStart < source.length && source[rightStart] === " ") {
    rightStart++;
  }
  if (rightStart >= source.length) {
    return null;
  }
  let rightEnd = rightStart;
  while (
    rightEnd < source.length &&
    source[rightEnd] !== " " &&
    source[rightEnd] !== ";" &&
    source[rightEnd] !== "}" &&
    source[rightEnd] !== ")"
  ) {
    rightEnd++;
  }
  const rightExpr = source.substring(rightStart, rightEnd).trim();
  if (leftExpr === "" || rightExpr === "") {
    return null;
  }
  return { leftExpr, rightExpr };
}

function validateOperandTypes(
  leftExpr: string,
  rightExpr: string,
  metadata: VariableInfo[],
  operator: string,
  source: string,
): Result<void, CompileError> {
  const operands = [
    { expr: leftExpr, side: "left" },
    { expr: rightExpr, side: "right" },
  ];
  let oIdx = 0;
  while (oIdx < operands.length) {
    const operand = operands[oIdx];
    const exprType = getExpressionType(operand.expr, metadata);
    if (exprType !== "Bool" && exprType !== "") {
      return err(
        createCompileError(
          source,
          `Type mismatch in logical operator '${operator}': ${operand.side} operand has type '${exprType}' but Bool is required`,
          "Logical operators || and && only work with boolean operands",
          `Change the ${operand.side} operand to a boolean expression or variable`,
        ),
      );
    }
    oIdx++;
  }
  return ok(void 0);
}

export { getExpressionType, extractOperands, validateOperandTypes };
