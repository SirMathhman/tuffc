import { Result, CompileError, ok } from "../types";
import {
  stripNumericTypeSuffixes,
  transformComparisonOperators,
  transformReadPatterns,
} from "../transformations/transformations";
import { findMatchingParen, extractParamNames } from "./compilation-fn-helpers";

function buildFnIife(
  fnName: string,
  paramNames: string,
  transformedBody: string,
  returnExpr: string,
): string {
  return `(function() { function ${fnName}(${paramNames}) { return ${transformedBody}; } return ${returnExpr}; })()`;
}

function compileFnStatement(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith("fn ")) return null;

  const arrowIdx = trimmed.indexOf("=>");
  if (arrowIdx === -1) return null;
  const semiIdx = trimmed.indexOf(";", arrowIdx + 2);
  if (semiIdx === -1) return null;

  const decl = trimmed.substring(0, arrowIdx).trim();
  const body = trimmed.substring(arrowIdx + 2, semiIdx).trim();
  const after = trimmed.substring(semiIdx + 1).trim();

  const openParen = decl.indexOf("(");
  if (openParen === -1) return null;
  const closeParen = findMatchingParen(decl, openParen);
  if (closeParen === -1) return null;

  const fnName = decl.substring(3, openParen).trim();
  const paramsRaw = decl.substring(openParen + 1, closeParen);
  const paramNames = extractParamNames(paramsRaw);

  const transformedBody = stripNumericTypeSuffixes(
    transformComparisonOperators(transformReadPatterns(body)),
  );

  const afterExpr = stripNumericTypeSuffixes(
    transformComparisonOperators(transformReadPatterns(after)),
  );
  let returnExpr = afterExpr;
  if (returnExpr === "") returnExpr = "0";
  return ok(buildFnIife(fnName, paramNames, transformedBody, returnExpr));
}

export { compileFnStatement };
