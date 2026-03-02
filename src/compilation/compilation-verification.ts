import {
  Result,
  CompileError,
  VariableInfo,
  ok,
  err,
  createCompileError,
} from "../types";
import {
  checkReassignments,
  checkVariableDuplicates,
  checkAssignmentTypeMatch,
  checkUndefinedVariables,
  checkPointerOperators,
  checkLogicalOperatorTypes,
  checkArithmeticOperatorTypes,
} from "../validators/validators";
import { extractReadType } from "../extractors/extractors";

function verifyLetStatement(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const dupRes = checkVariableDuplicates(metadata);
  if (dupRes.type === "err") return dupRes;

  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.stmt.indexOf("read<") !== -1) {
      const readType = extractReadType(varInfo.stmt);
      if (
        varInfo.declaredType !== "" &&
        readType !== "" &&
        varInfo.declaredType !== readType
      ) {
        return err(
          createCompileError(
            varInfo.stmt,
            `Type mismatch: declared variable as '${varInfo.declaredType}' but initialized with 'read<${readType}>()'`,
            "Variable declaration type must match the type of the read operation",
            `Change either the declared type to '${readType}' or the read type to '<${varInfo.declaredType}>'`,
          ),
        );
      }
    }
    i++;
  }

  const assignRes = checkAssignmentTypeMatch(metadata);
  if (assignRes.type === "err") return assignRes;

  const ptrRes = checkPointerOperators(source, metadata);
  if (ptrRes.type === "err") return ptrRes;

  const logicalOpRes = checkLogicalOperatorTypes(source, metadata);
  if (logicalOpRes.type === "err") return logicalOpRes;

  const arithmeticOpRes = checkArithmeticOperatorTypes(source, metadata);
  if (arithmeticOpRes.type === "err") return arithmeticOpRes;

  const undefRes = checkUndefinedVariables(source, metadata);
  if (undefRes.type === "err") return undefRes;

  const reassignRes = checkReassignments(source, metadata);
  if (reassignRes.type === "err") return reassignRes;

  return ok(void 0);
}

export { verifyLetStatement };
