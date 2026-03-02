import {
  VariableInfo,
  Result,
  CompileError,
  err,
  createCompileError,
} from "./types";
import { findVariable } from "./metadata";
import { undeclaredVariableError, varNotDeclaredHint, checkOperatorUsage } from "./validators-pointer-helpers";

function checkDereferenceOperator(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const derefChecker = (varName: string): Result<void, CompileError> => {
    const varInfo = findVariable(varName, metadata);
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is dereferenced but never declared",
        varNotDeclaredHint(varName, " : *<type> = <value>;"),
      );
    }
    if (!varInfo.declaredType.includes("*")) {
      const t = varInfo.declaredType;
      return err(
        createCompileError(
          source,
          `Cannot dereference non-pointer variable: '${varName}' has type '${t}' but attempted dereference requires pointer type`,
          "Dereference operator (*) can only be applied to pointer types",
          `Change '${varName}' to a pointer type (e.g., : *${t}) or use variable directly`,
        ),
      );
    }
    return { type: "ok", value: void 0 };
  };
  return checkOperatorUsage(source, "*", derefChecker, true) as Result<void, CompileError>;
}

export { checkDereferenceOperator };
