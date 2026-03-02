import { Result, CompileError, ok } from "../types";
import {
  stripNumericTypeSuffixes,
  stripTypeAnnotations,
  transformComparisonOperators,
  transformReadPatterns,
  transformMethodCalls,
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

function renameThisParameter(source: string): string {
  // Replace standalone 'this' with '_this' (at word boundaries)
  let result = "";
  let i = 0;
  while (i < source.length) {
    const isThisWord =
      i + 4 <= source.length &&
      source.substring(i, i + 4) === "this" &&
      (i === 0 || !isAlphaNumeric(source[i - 1])) &&
      (i + 4 === source.length || !isAlphaNumeric(source[i + 4]));

    if (isThisWord) {
      result += "_this";
      i += 4;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

function isAlphaNumeric(char: string): boolean {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    (char >= "0" && char <= "9") ||
    char === "_"
  );
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

  const fnNameRaw = decl.substring(3, openParen).trim();
  const fnName = stripTypeAnnotations(fnNameRaw);
  const paramsRaw = decl.substring(openParen + 1, closeParen);
  const paramNames = extractParamNames(paramsRaw);

  // Rename 'this' to '_this' in the body since 'this' is a reserved keyword
  const bodyWithRenamedThis = renameThisParameter(body);

  const transformedBody = stripNumericTypeSuffixes(
    transformComparisonOperators(
      transformMethodCalls(transformReadPatterns(bodyWithRenamedThis)),
    ),
  );

  const afterExpr = stripNumericTypeSuffixes(
    transformComparisonOperators(
      transformMethodCalls(
        stripTypeAnnotations(transformReadPatterns(renameThisParameter(after))),
      ),
    ),
  );
  let returnExpr = afterExpr;
  if (returnExpr === "") returnExpr = "0";
  return ok(buildFnIife(fnName, paramNames, transformedBody, returnExpr));
}

export { compileFnStatement };
