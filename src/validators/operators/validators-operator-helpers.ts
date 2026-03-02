import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "../../types";

function createOperatorTypeError(
  operatorType: string,
  op: string,
  side: string,
  type: string,
  expectedType: string,
  operatorDescription: string,
  actionVerb: string,
): { message: string; explanation: string; hint: string } {
  return {
    message: `Type mismatch in ${operatorType} operator '${op}': ${side} operand has type '${type}' but ${expectedType} is required`,
    explanation: operatorDescription,
    hint: `${actionVerb} the ${side} operand to a ${expectedType.toLowerCase()} expression or variable`,
  };
}

function validateBinaryOperandTypes(
  leftExpr: string,
  rightExpr: string,
  metadata: VariableInfo[],
  operator: string,
  source: string,
  getExprType: (_expr: string, _metadata: VariableInfo[]) => string,
  isInvalidType: (_type: string) => boolean,
  errorMessage: (
    _op: string,
    _side: string,
    _type: string,
  ) => { message: string; explanation: string; hint: string },
): Result<void, CompileError> {
  const operands = [
    { expr: leftExpr, side: "left" },
    { expr: rightExpr, side: "right" },
  ];
  let oIdx = 0;
  while (oIdx < operands.length) {
    const operand = operands[oIdx];
    const exprType = getExprType(operand.expr, metadata);
    if (isInvalidType(exprType)) {
      const errInfo = errorMessage(operator, operand.side, exprType);
      return err(
        createCompileError(
          source,
          errInfo.message,
          errInfo.explanation,
          errInfo.hint,
        ),
      );
    }
    oIdx++;
  }
  return ok(void 0);
}

export { validateBinaryOperandTypes, createOperatorTypeError };
