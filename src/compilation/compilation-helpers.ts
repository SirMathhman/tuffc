import { Result, CompileError, ok, err, createCompileError } from "../types";
import { validateTypeSuffix } from "../validators/validators";
import { extractNumericPart, extractBlockAndAfter } from "../extractors/extractors";

function parseNumberLiteral(trimmed: string): Result<string, CompileError> {
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return ok(trimmed);
  }

  const isNegative = trimmed[0] === "-";
  let numericStart: number;
  if (isNegative) {
    numericStart = 1;
  } else {
    numericStart = 0;
  }

  const { numericPart, endIndex } = extractNumericPart(trimmed, numericStart);

  if (numericPart !== "") {
    num = Number(numericPart);
    if (!Number.isNaN(num)) {
      const hasSuffix = endIndex < trimmed.length;

      if (isNegative && hasSuffix) {
        return err(
          createCompileError(
            trimmed,
            "Negative numbers with type suffixes are not allowed",
            "Type suffixes are only valid for positive literal values",
            "Remove the type suffix from the negative number, or remove the minus sign if the value should be positive",
          ),
        );
      }

      if (hasSuffix) {
        const suffix = trimmed.slice(endIndex);
        const validationResult = validateTypeSuffix(suffix, num, trimmed);
        if (validationResult.type === "err") {
          return validationResult;
        }
      }

      return ok(numericPart);
    }
  }

  return err(
    createCompileError(
      trimmed,
      `Cannot parse as a number: '${trimmed}'`,
      "Expected a valid numeric literal (e.g., '42', '-100', '255U8')",
      `Provide a valid number or use a variable declaration (let x = ${trimmed};)`,
    ),
  );
}

function generateFunctionFromLastStatement(
  beforeLastStatement: string,
  lastStatement: string,
): string {
  const { block, after } = extractBlockAndAfter(lastStatement);
  if (block !== null) {
    let returnVal: string;
    if (after === "") {
      returnVal = "0";
    } else {
      returnVal = after;
    }
    return `(function() { ${beforeLastStatement} ${block} return ${returnVal}; })()`;
  }
  if (lastStatement.startsWith("{}")) {
    const afterBlock = lastStatement.substring(2).trim();
    let returnVal: string;
    if (afterBlock === "") {
      returnVal = "0";
    } else {
      returnVal = afterBlock;
    }
    return `(function() { ${beforeLastStatement} return ${returnVal}; })()`;
  }
  return `(function() { ${beforeLastStatement} return ${lastStatement}; })()`;
}

export { parseNumberLiteral, generateFunctionFromLastStatement };
