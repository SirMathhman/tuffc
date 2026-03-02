/* eslint-disable max-lines */
import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "../types";
import {
  extractAfterEq,
  extractReadType,
  extractIdentifier,
} from "../extractors/extractors";

function isUpconversionAllowed(fromType: string, toType: string): boolean {
  return (
    fromType === toType ||
    (fromType === "U8" &&
      ["U16", "U32", "U64", "I16", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "U16" &&
      ["U32", "U64", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "U32" && ["U64", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I8" && ["I16", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I16" && ["I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I32" && toType === "I64")
  );
}

function validateTypeSuffix(
  suffix: string,
  value: number,
  code: string,
): Result<void, CompileError> {
  if (suffix === "U8") {
    if (value < 0 || value > 255) {
      return err(
        createCompileError(
          code,
          `U8 values must be in range 0-255, got: ${value}`,
          "U8 is an unsigned 8-bit integer with valid range 0-255",
          `Use a value between 0 and 255, or use a different type like I16 or I32 for larger values`,
        ),
      );
    }
  }
  return ok(void 0);
}

function validateReassignment(
  stmt: string,
  identifier: string,
  metaVar: VariableInfo,
): Result<void, CompileError> {
  if (!metaVar.isMutable) {
    return err(
      createCompileError(
        stmt,
        `Cannot reassign immutable variable: '${identifier}'`,
        "Only mutable variables declared with 'let mut' can be reassigned",
        `Change the declaration to 'let mut ${identifier} = ...' to allow reassignment`,
      ),
    );
  }
  const afterEq = extractAfterEq(stmt);
  const assignedType = extractReadType(afterEq);
  if (assignedType !== "") {
    const varType = metaVar.inferredType;
    if (!isUpconversionAllowed(assignedType, varType)) {
      return err(
        createCompileError(
          stmt,
          `Type mismatch in reassignment: cannot assign '${assignedType}' to variable '${identifier}' of type '${varType}'`,
          "Variable reassignments must match the declared type",
          `Change the assignment to use type '${varType}' or change the variable's type`,
        ),
      );
    }
  }
  return ok(void 0);
}

function checkAssignmentTypeMatch(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.declaredType === "") {
      i++;
      continue;
    }
    const eqIndex = varInfo.stmt.indexOf("=");
    let assignedVar = "";
    if (eqIndex !== -1) {
      const afterEq = varInfo.stmt.substring(eqIndex + 1).trim();
      assignedVar = extractIdentifier(afterEq, 0);
    }
    if (assignedVar !== "") {
      let j = 0;
      while (j < metadata.length) {
        if (metadata[j].name === assignedVar) {
          const fromType = metadata[j].inferredType;
          const toType = varInfo.declaredType;
          if (!isUpconversionAllowed(fromType, toType)) {
            return err(
              createCompileError(
                varInfo.stmt,
                `Type mismatch: variable '${assignedVar}' has type '${fromType}' but '${toType}' was expected`,
                "Variable assignments must match the declared type",
                `Change the declared type to '${fromType}' or assign a different variable`,
              ),
            );
          }
          break;
        }
        j++;
      }
    }
    i++;
  }
  return ok(void 0);
}

export {
  isUpconversionAllowed,
  validateTypeSuffix,
  validateReassignment,
  checkAssignmentTypeMatch,
};
