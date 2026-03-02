import { VariableInfo, Result, CompileError, ok } from "../../types";
import {
  getExpressionType,
  extractOperands,
} from "./validators-logical-helpers";
import {
  validateBinaryOperandTypes,
  createOperatorTypeError,
} from "./validators-operator-helpers";

function createLogicalTypeError(
  op: string,
  side: string,
  type: string,
): { message: string; explanation: string; hint: string } {
  return createOperatorTypeError(
    "logical",
    op,
    side,
    type,
    "Bool",
    "Logical operators || and && only work with boolean operands",
    "Change",
  );
}

function checkOperatorUsage(
  source: string,
  metadata: VariableInfo[],
  operator: string,
): Result<void, CompileError> {
  let i = 0;
  while (i < source.length - 1) {
    if (source[i] === operator[0] && source[i + 1] === operator[1]) {
      const operands = extractOperands(source, i);
      if (operands !== null) {
        const validRes = validateBinaryOperandTypes(
          operands.leftExpr,
          operands.rightExpr,
          metadata,
          operator,
          source,
          getExpressionType,
          (type: string): boolean => type !== "Bool" && type !== "",
          createLogicalTypeError,
        );
        if (validRes.type === "err") return validRes;
      }
      i += 2;
    } else {
      i++;
    }
  }
  return ok(void 0);
}

function checkLogicalOperatorTypes(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const orRes = checkOperatorUsage(source, metadata, "||");
  if (orRes.type === "err") return orRes;
  return checkOperatorUsage(source, metadata, "&&");
}

export { checkLogicalOperatorTypes, getExpressionType, checkOperatorUsage };
