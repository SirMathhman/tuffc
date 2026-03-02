import { Result, CompileError, VariableInfo, ok } from "../types";
import {
  checkReassignments,
  checkUndefinedVariables,
  checkBlockScopes,
  checkBlockExpressions,
  checkBlockExpressionType,
  checkLogicalOperatorTypes,
} from "../validators/validators";
import { transformReadPatterns } from "../transformations/transformations";
import { parseNumberLiteral } from "./compilation-helpers";
import { compileLetStatement } from "./compilation-let";

export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  const blockScopeRes = checkBlockScopes(source);
  if (blockScopeRes !== null) {
    return blockScopeRes;
  }

  const blockExprRes = checkBlockExpressions(source);
  if (blockExprRes !== null) {
    return blockExprRes;
  }

  const blockTypeRes = checkBlockExpressionType(source);
  if (blockTypeRes !== null) {
    return blockTypeRes;
  }

  const letRes = compileLetStatement(source);
  if (letRes !== null) {
    return letRes;
  }

  if (trimmed.indexOf("read<") !== -1) {
    const emptyMetadata: VariableInfo[] = [];
    const reassignRes = checkReassignments(trimmed, emptyMetadata);
    if (reassignRes.type === "err") {
      return reassignRes;
    }
    return ok(transformReadPatterns(trimmed));
  }

  if (trimmed.startsWith("{}")) {
    const afterBlock = trimmed.substring(2).trim();
    if (afterBlock !== "") {
      return compile(afterBlock);
    }
    return ok("0");
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") {
    return undefCheckResult;
  }

  const logicalOpCheckResult = checkLogicalOperatorTypes(trimmed, []);
  if (logicalOpCheckResult.type === "err") {
    return logicalOpCheckResult;
  }

  return parseNumberLiteral(trimmed);
}
