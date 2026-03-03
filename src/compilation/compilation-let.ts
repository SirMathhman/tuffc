import { Result, CompileError, ok } from "../types";
import { buildVariableMetadata } from "../metadata/metadata";
import {
  wrapBlockExpressionInInit,
  stripTypeAnnotations,
  transformReadPatterns,
  transformThisAccess,
  transformAddressOf,
  transformDereference,
  stripNumericTypeSuffixes,
  transformIfElseToTernary,
  transformComparisonOperators,
  transformWhileLoops,
  transformFnDeclarations,
  transformMethodCalls,
} from "../transformations/transformations";
import { generateFunctionFromLastStatement } from "./compilation-helpers";
import { verifyLetStatement } from "./compilation-verification";

function findLastSemicolon(code: string): number {
  let braceDepth = 0;
  let lastSemicolonIndex = -1;
  let i = 0;
  while (i < code.length) {
    if (code[i] === "{") {
      braceDepth++;
    } else if (code[i] === "}") {
      braceDepth--;
    } else if (code[i] === ";" && braceDepth === 0) {
      lastSemicolonIndex = i;
    }
    i++;
  }
  return lastSemicolonIndex;
}

function compileLetStatement(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (trimmed.indexOf("let ") === -1 && trimmed.indexOf("const ") === -1) {
    return null;
  }
  const processedSource = transformIfElseToTernary(
    wrapBlockExpressionInInit(trimmed),
  );
  const metadata = buildVariableMetadata(processedSource);
  const verRes = verifyLetStatement(processedSource, metadata);
  if (verRes.type === "err") return verRes;
  const code = stripNumericTypeSuffixes(
    transformDereference(
      transformAddressOf(
        transformComparisonOperators(
          stripTypeAnnotations(
            transformThisAccess(
              transformMethodCalls(
                transformFnDeclarations(
                  transformWhileLoops(transformReadPatterns(processedSource)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  const lastSemicolonIndex = findLastSemicolon(code);
  if (lastSemicolonIndex === -1) {
    return ok(`(function() { return ${code}; })()`);
  }
  const beforeLastStatement = code.substring(0, lastSemicolonIndex + 1);
  const lastStatement = code.substring(lastSemicolonIndex + 1).trim();
  if (lastStatement === "") {
    return ok(`(function() { ${code} return 0; })()`);
  }
  const generatedCode = generateFunctionFromLastStatement(
    beforeLastStatement,
    lastStatement,
  );
  return ok(generatedCode);
}

export { verifyLetStatement, compileLetStatement };
