import { VariableInfo, Result, CompileError, ok } from "../../types";
import { getExpressionType } from "./validators-logical-helpers";
import {
  createOperatorTypeError,
  makeOperatorChecker,
} from "./validators-operator-helpers";

function createComparisonTypeError(
  op: string,
  side: string,
  type: string,
): { message: string; explanation: string; hint: string } {
  return createOperatorTypeError(
    "comparison",
    op,
    side,
    type,
    "numeric type",
    "Comparison operators <, >, <=, >= only work with numeric operands",
    "Convert",
  );
}

const checkComparisonOperatorUsage = makeOperatorChecker(
  getExpressionType,
  createComparisonTypeError,
  (s: string, i: number, o: string) => s.substring(i, i + o.length) === o,
);

function checkComparisonOperatorTypes(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const comparisonOps = ["<=", ">=", "<", ">"];

  for (const op of comparisonOps) {
    const result = checkComparisonOperatorUsage(source, metadata, op);
    if (result.type === "err") {
      return result;
    }
  }

  return ok(void 0);
}

export { checkComparisonOperatorTypes };
