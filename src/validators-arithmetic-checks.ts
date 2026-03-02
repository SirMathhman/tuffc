import { VariableInfo, Result, CompileError, ok } from "./types";
import { getExpressionType } from "./validators-logical-helpers";
import { extractBinaryOperands } from "./extractors-operators";
import {
  validateBinaryOperandTypes,
  createOperatorTypeError,
} from "./validators-operator-helpers";

function createArithmeticTypeError(
  op: string,
  side: string,
  type: string,
): { message: string; explanation: string; hint: string } {
  return createOperatorTypeError(
    "arithmetic",
    op,
    side,
    type,
    "numeric type",
    "Arithmetic operators +, -, *, / only work with numeric operands",
    "Convert",
  );
}

function checkArithmeticOperatorUsage(
  source: string,
  metadata: VariableInfo[],
  operator: string,
): Result<void, CompileError> {
  let i = 0;
  while (i < source.length) {
    if (source[i] === operator) {
      const operands = extractBinaryOperands(source, i, 1);
      if (operands === null) {
        i++;
        continue;
      }
      const validRes = validateBinaryOperandTypes(
        operands.leftExpr,
        operands.rightExpr,
        metadata,
        operator,
        source,
        getExpressionType,
        (type: string): boolean => type === "Bool",
        createArithmeticTypeError,
      );
      if (validRes.type === "err") return validRes;
    }
    i++;
  }
  return ok(void 0);
}

function checkArithmeticOperatorTypes(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const operators = ["+", "-", "*", "/"];
  let opIdx = 0;
  while (opIdx < operators.length) {
    const opRes = checkArithmeticOperatorUsage(
      source,
      metadata,
      operators[opIdx],
    );
    if (opRes.type === "err") return opRes;
    opIdx++;
  }
  return ok(void 0);
}

export { checkArithmeticOperatorTypes };
