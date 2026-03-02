import { Result, CompileError, VariableInfo, ok } from "../types";
import {
  checkReassignments,
  checkUndefinedVariables,
  checkBlockScopes,
  checkBlockExpressions,
  checkBlockExpressionType,
  checkLogicalOperatorTypes,
  checkComparisonOperatorTypes,
} from "../validators/validators";
import {
  transformReadPatterns,
  transformComparisonOperators,
} from "../transformations/transformations";
import { parseNumberLiteral } from "./compilation-helpers";
import { compileFnStatement } from "./compilation-fn";
import { compileLetStatement } from "./compilation-let";

export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();
  if (trimmed === "") return ok("0");
  const blockScopeRes = checkBlockScopes(source);
  if (blockScopeRes !== null) return blockScopeRes;
  const blockExprRes = checkBlockExpressions(source);
  if (blockExprRes !== null) return blockExprRes;
  const blockTypeRes = checkBlockExpressionType(source);
  if (blockTypeRes !== null) return blockTypeRes;
  const letRes = compileLetStatement(source);
  if (letRes !== null) return letRes;
  const fnRes = compileFnStatement(source);
  if (fnRes !== null) return fnRes;

  if (trimmed.indexOf("read<") !== -1) {
    const emptyMetadata: VariableInfo[] = [];
    const reassignChk = checkReassignments(trimmed, emptyMetadata);
    if (reassignChk.type === "err") return reassignChk;
    const compChk = checkComparisonOperatorTypes(trimmed, emptyMetadata);
    if (compChk.type === "err") return compChk;
    const transformed = transformComparisonOperators(
      transformReadPatterns(trimmed),
    );
    return ok(transformed);
  }

  if (trimmed.startsWith("{}")) {
    const afterBlock = trimmed.substring(2).trim();
    if (afterBlock !== "") return compile(afterBlock);
    return ok("0");
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") return undefCheckResult;

  const logicalOpCheckResult = checkLogicalOperatorTypes(trimmed, []);
  if (logicalOpCheckResult.type === "err") return logicalOpCheckResult;

  return parseNumberLiteral(trimmed);
}
