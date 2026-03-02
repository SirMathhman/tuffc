import { VariableInfo, Result, CompileError } from "../types";
import { checkAddressOfOperator } from "./validators-pointer-address-of";
import { checkDereferenceOperator } from "./validators-pointer-dereference";
import { checkImmutablePointerAssignments } from "./validators-pointer-mutations";
import {
  undeclaredVariableError,
  varNotDeclaredHint,
} from "./validators-pointer-helpers";

function checkPointerOperators(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const addressOfRes = checkAddressOfOperator(source, metadata);
  if (addressOfRes.type === "err") return addressOfRes;
  const derefRes = checkDereferenceOperator(source, metadata);
  if (derefRes.type === "err") return derefRes;
  return checkImmutablePointerAssignments(source, metadata);
}

export { checkPointerOperators, undeclaredVariableError, varNotDeclaredHint };
