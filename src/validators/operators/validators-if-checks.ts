import {
  Result,
  CompileError,
  VariableInfo,
  err,
  createCompileError,
} from "../../types";
import { getExpressionType } from "./validators-logical-helpers";

function createConditionTypeError(
  condition: string,
  typeDescription: string,
): Result<void, CompileError> {
  return err(
    createCompileError(
      condition,
      "Type mismatch in if-statement condition",
      `Expected boolean type, found ${typeDescription}`,
      `Use 'true' or 'false' instead of ${typeDescription}`,
    ),
  );
}

function checkIfConditionTypes(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> | null {
  let i = 0;
  while (i < source.length - 2) {
    if (source.substring(i, i + 3) === "if ") {
      const condStart = source.indexOf("(", i);
      if (condStart === -1) {
        i++;
        continue;
      }
      let parenDepth = 0;
      let condEnd = condStart;
      while (condEnd < source.length) {
        if (source[condEnd] === "(") parenDepth++;
        else if (source[condEnd] === ")") {
          parenDepth--;
          if (parenDepth === 0) break;
        }
        condEnd++;
      }
      const condition = source.substring(condStart + 1, condEnd).trim();
      const condType = getExpressionType(condition, metadata);
      if (condType !== "" && condType !== "Bool") {
        return createConditionTypeError(condition, `'${condType}'`);
      }
      if (condType === "" && condition !== "true" && condition !== "false") {
        const num = Number(condition);
        if (!Number.isNaN(num)) {
          return createConditionTypeError(condition, `numeric literal`);
        }
      }
    }
    i++;
  }
  return null;
}

export { checkIfConditionTypes };
