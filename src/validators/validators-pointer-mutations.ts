import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "../types";
import { extractIdentifier, isAssignmentOperator } from "../extractors/extractors";

function checkImmutablePointerAssignments(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let ai = 0;
  while (ai < source.length) {
    if (source[ai] === "*") {
      const varName = extractIdentifier(source, ai + 1);
      if (varName !== "") {
        const afterVar = ai + 1 + varName.length;
        if (isAssignmentOperator(source, afterVar)) {
          let mi = 0;
          while (mi < metadata.length) {
            if (metadata[mi].name === varName) {
              const varInfo = metadata[mi];
              if (!varInfo.declaredType.includes("mut")) {
                return err(
                  createCompileError(
                    source,
                    `Cannot assign through immutable pointer: '${varName}' has type '${varInfo.declaredType}' but assignment through pointer requires mutable pointer type (*mut)`,
                    "Assignment through dereference (*ptr = value) requires a mutable pointer",
                    `Change '${varName}' to a mutable pointer type (: *mut <type>) or use direct assignment`,
                  ),
                );
              }
              break;
            }
            mi++;
          }
        }
      }
    }
    ai++;
  }
  return ok(void 0);
}

export { checkImmutablePointerAssignments };
