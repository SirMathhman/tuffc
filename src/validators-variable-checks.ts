import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "./types";
import { extractIdentifier, isAlpha } from "./extractors";
import { findVariable } from "./metadata";
import { checkReassignments } from "./validators-variable-reassignment";

function checkVariableDuplicates(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    let j = i + 1;
    while (j < metadata.length) {
      if (metadata[j].name === varInfo.name) {
        return err(
          createCompileError(
            varInfo.stmt,
            `Duplicate variable declaration: '${varInfo.name}' is already declared`,
            "Variables can only be declared once in a scope",
            `Use a different variable name, or remove the duplicate declaration`,
          ),
        );
      }
      j++;
    }
    i++;
  }
  return ok(void 0);
}

function checkUndefinedVariables(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return ok(void 0);
  }
  const firstChar = trimmed[0];
  if (!isAlpha(firstChar)) {
    return ok(void 0);
  }
  const identifier = extractIdentifier(trimmed, 0);
  if (identifier === trimmed) {
    const varInfo = findVariable(identifier, metadata);
    if (varInfo === undefined) {
      return err(
        createCompileError(
          source,
          `Undefined variable: '${identifier}' is referenced but never declared`,
          "All variables must be declared with 'let' before they can be used",
          `Declare '${identifier}' using 'let ${identifier} = <value>;' before using it`,
        ),
      );
    }
  }
  return ok(void 0);
}

export { checkVariableDuplicates, checkUndefinedVariables, checkReassignments };
