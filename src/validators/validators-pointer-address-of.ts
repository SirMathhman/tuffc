import { VariableInfo, Result, CompileError } from "../types";
import { findVariable } from "../metadata/metadata";
import { checkMixedPointerTypes } from "./validators-pointer-mixed-types";
import {
  undeclaredVariableError,
  varNotDeclaredHint,
  checkOperatorUsage,
} from "./validators-pointer-helpers";

function checkAddressOfOperator(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const mixedRes = checkMixedPointerTypes(source);
  if (mixedRes.type === "err") return mixedRes;
  const addressOfChecker = (varName: string): Result<void, CompileError> => {
    const varInfo = findVariable(varName, metadata);
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is referenced with address-of operator but never declared",
        varNotDeclaredHint(varName, " = <value>;"),
      );
    }
    return { type: "ok", value: void 0 };
  };
  return checkOperatorUsage(
    source,
    "&",
    addressOfChecker,
    false,
    "mut ",
  ) as Result<void, CompileError>;
}

export { checkAddressOfOperator };
