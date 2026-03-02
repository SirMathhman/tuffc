import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "../../types";
import { extractBinaryOperands } from "../../extractors/extractors-operators";
import type { EM } from "./validators-operator-helpers";

function validateBinaryOperandTypes(
  leftExpr: string,
  rightExpr: string,
  metadata: VariableInfo[],
  operator: string,
  source: string,
  getExprType: (_e: string, _m: VariableInfo[]) => string,
  isInvalidType: (_t: string) => boolean,
  errorMessage: EM,
): Result<void, CompileError> {
  const sides = [
    { expr: leftExpr, side: "left" },
    { expr: rightExpr, side: "right" },
  ];
  for (const side of sides) {
    const t = getExprType(side.expr, metadata);
    if (isInvalidType(t)) {
      const e = errorMessage(operator, side.side, t);
      return err(createCompileError(source, e.message, e.explanation, e.hint));
    }
  }
  return ok(void 0);
}

function checkBinaryOperatorUsage(
  source: string,
  metadata: VariableInfo[],
  operator: string,
  getExprType: (_e: string, _m: VariableInfo[]) => string,
  isInvalidType: (_t: string) => boolean,
  errorMessage: EM,
  matchChar: (_s: string, _i: number, _o: string) => boolean,
): Result<void, CompileError> {
  let i = 0;
  while (i < source.length) {
    if (matchChar(source, i, operator)) {
      const op = extractBinaryOperands(source, i, 1);
      if (op !== null) {
        const v = validateBinaryOperandTypes(
          op.leftExpr,
          op.rightExpr,
          metadata,
          operator,
          source,
          getExprType,
          isInvalidType,
          errorMessage,
        );
        if (v.type === "err") return v;
      }
    }
    i++;
  }
  return ok(void 0);
}

export { validateBinaryOperandTypes, checkBinaryOperatorUsage };
