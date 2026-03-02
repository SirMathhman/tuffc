import { VariableInfo, Result, CompileError, ok, err, createCompileError } from "../../types";
import { extractBinaryOperands } from "../../extractors/extractors-operators";
type EM = (_op: string, _side: string, _type: string) => { message: string; explanation: string; hint: string };

function createOperatorTypeError(operatorType: string, op: string, side: string, type: string, expectedType: string, operatorDescription: string, actionVerb: string): { message: string; explanation: string; hint: string } {
  return { message: `Type mismatch in ${operatorType} operator '${op}': ${side} operand has type '${type}' but ${expectedType} is required`, explanation: operatorDescription, hint: `${actionVerb} the ${side} operand to a ${expectedType.toLowerCase()} expression or variable` };
}
function validateBinaryOperandTypes(leftExpr: string, rightExpr: string, metadata: VariableInfo[], operator: string, source: string, getExprType: (_e: string, _m: VariableInfo[]) => string, isInvalidType: (_t: string) => boolean, errorMessage: EM): Result<void, CompileError> {
  for (const x of [{expr: leftExpr, side: "left"}, {expr: rightExpr, side: "right"}]) {
    const t = getExprType(x.expr, metadata);
    if (isInvalidType(t)) { const e = errorMessage(operator, x.side, t); return err(createCompileError(source, e.message, e.explanation, e.hint)); }
  }
  return ok(void 0);
}
function checkBinaryOperatorUsage(source: string, metadata: VariableInfo[], operator: string, getExprType: (_e: string, _m: VariableInfo[]) => string, isInvalidType: (_t: string) => boolean, errorMessage: EM, matchChar: (_s: string, _i: number, _o: string) => boolean): Result<void, CompileError> {
  let i = 0;
  while (i < source.length) {
    if (matchChar(source, i, operator)) { const op = extractBinaryOperands(source, i, 1); if (op !== null) { const v = validateBinaryOperandTypes(op.leftExpr, op.rightExpr, metadata, operator, source, getExprType, isInvalidType, errorMessage); if (v.type === "err") return v; } }
    i++;
  }
  return ok(void 0);
}
function makeOperatorChecker(getExprType: (_e: string, _m: VariableInfo[]) => string, em: EM, m: (_s: string, _i: number, _o: string) => boolean) {
  return (src: string, meta: VariableInfo[], op: string) => checkBinaryOperatorUsage(src, meta, op, getExprType, (t) => t === "Bool", em, m);
}
export { validateBinaryOperandTypes, createOperatorTypeError, checkBinaryOperatorUsage, makeOperatorChecker };
