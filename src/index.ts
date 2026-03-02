interface Ok<T> {
  type: "ok";
  value: T;
}

interface Err<E> {
  type: "err";
  error: E;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T, E>(value: T): Result<T, E> {
  return { type: "ok", value };
}

function err<T, E>(error: E): Result<T, E> {
  return { type: "err", error };
}

function validateTypeSuffix(
  suffix: string,
  value: number,
): Result<void, string> {
  if (suffix === "U8") {
    if (value < 0 || value > 255) {
      return err(`U8 values must be in range 0-255, got: ${value}`);
    }
  }
  return ok(void 0);
}

function extractNumericPart(
  source: string,
  startIndex: number,
): { numericPart: string; endIndex: number } {
  let numericPart = "";
  let endIndex = startIndex;
  let i = startIndex;
  while (i < source.length) {
    const char = source[i];
    if ((char >= "0" && char <= "9") || char === ".") {
      numericPart += char;
      endIndex = i + 1;
      i++;
    } else {
      break;
    }
  }
  return { numericPart, endIndex };
}

export function compile(source: string): Result<string, string> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  // Try parsing as a full number first
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return ok(trimmed);
  }

  // Check if input starts with minus sign
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
      // Check if there's a type suffix after the numeric part
      const hasSuffix = endIndex < trimmed.length;

      // Negative numbers with type suffixes are not allowed
      if (isNegative && hasSuffix) {
        return err(
          `Negative numbers with type suffixes are not allowed: ${trimmed}`,
        );
      }

      // Extract and validate type suffix if present
      if (hasSuffix) {
        const suffix = trimmed.slice(endIndex);
        const validationResult = validateTypeSuffix(suffix, num);
        if (validationResult.type === "err") {
          return validationResult;
        }
      }

      let resultValue: string;
      if (isNegative) {
        resultValue = "-" + numericPart;
      } else {
        resultValue = numericPart;
      }
      return ok(resultValue);
    }
  }

  return ok("0");
}
