import { VariableInfo } from "../../types";
import {
  validateBinaryOperandTypes,
  checkBinaryOperatorUsage,
} from "./validators-operator-validation";

type EM = (
  _op: string,
  _side: string,
  _type: string,
) => { message: string; explanation: string; hint: string };

function createOperatorTypeError(
  opType: string,
  op: string,
  side: string,
  type: string,
  expectedType: string,
  opDesc: string,
  verb: string,
) {
  return {
    message: `Type mismatch in ${opType} operator '${op}': ${side} operand has type '${type}' but ${expectedType} is required`,
    explanation: opDesc,
    hint: `${verb} the ${side} operand to a ${expectedType.toLowerCase()} expression or variable`,
  };
}

function makeOperatorChecker(
  getExprType: (_e: string, _m: VariableInfo[]) => string,
  em: EM,
  m: (_s: string, _i: number, _o: string) => boolean,
) {
  return (src: string, meta: VariableInfo[], op: string) =>
    checkBinaryOperatorUsage(
      src,
      meta,
      op,
      getExprType,
      (t) => t === "Bool",
      em,
      m,
    );
}

export {
  type EM,
  validateBinaryOperandTypes,
  createOperatorTypeError,
  checkBinaryOperatorUsage,
  makeOperatorChecker,
};
