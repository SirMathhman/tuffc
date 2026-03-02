import { VariableInfo, Result, CompileError, ok } from "../../types";
import { getExpressionType } from "./validators-logical-helpers";
import {
  createOperatorTypeError,
  makeOperatorChecker,
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

const checkArithmeticOperatorUsage = makeOperatorChecker(
  getExpressionType,
  createArithmeticTypeError,
  (s: string, i: number, o: string) => s[i] === o,
);

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
