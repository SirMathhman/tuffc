/*
When working with this error, ensure that the content of the error actually applies to the situation
and is not just a fall-through.
*/
export interface CompileError {
  invalidSource: string;
  message: string;
  reason: string;
  fix: string;
}

export interface Ok<T> {
  type: "ok";
  value: T;
}

export interface Err<X> {
  type: "err";
  error: X;
}
export type Result<T, X> = Ok<T> | Err<X>;

function buildCompileError(
  invalidSource: string,
  reason: string,
  fix: string,
): CompileError {
  return {
    invalidSource,
    message: "Compilation failed",
    reason,
    fix,
  };
}

export function compileTuffToTS(
  tuffSource: string,
): Result<string, CompileError> {
  const trimmedSource = tuffSource.trim();

  if (trimmedSource === "") {
    return {
      type: "ok",
      value: "return 0;",
    };
  }

  // Literal numeric expressions are currently supported.
  // Accepts integer and float forms with optional integer width suffixes.
  const numericSuffixMatch = trimmedSource.match(
    /^([-+]?[0-9]+(?:\.[0-9]+)?)(U8|U16|U32|U64|I8|I16|I32|I64)?$/,
  );
  if (numericSuffixMatch) {
    const numericText = numericSuffixMatch[1] ?? "";
    const suffix = numericSuffixMatch[2] ?? "";

    if (suffix) {
      if (numericText.includes(".")) {
        return {
          type: "err",
          error: buildCompileError(
            tuffSource,
            "Syntax error",
            "Integer width suffixes require integer literals without decimal points.",
          ),
        };
      }

      let value: bigint;
      try {
        value = BigInt(numericText);
      } catch {
        return {
          type: "err",
          error: buildCompileError(
            tuffSource,
            "Syntax error",
            "Use a valid integer literal.",
          ),
        };
      }

      const bitSize = Number(suffix.slice(1));
      if (suffix.startsWith("U")) {
        const max = 2n ** BigInt(bitSize) - 1n;
        if (value < 0n || value > max) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Value out of range for unsigned integer",
              `Use a value between 0 and ${max} for ${suffix} literals.`,
            ),
          };
        }
      } else {
        // signed
        const min = -(2n ** BigInt(bitSize - 1));
        const max = 2n ** BigInt(bitSize - 1) - 1n;
        if (value < min || value > max) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Value out of range for signed integer",
              `Use a value between ${min} and ${max} for ${suffix} literals.`,
            ),
          };
        }
      }

      // `U*` and `I*` produce number outputs when in safe range.
      return {
        type: "ok",
        value: `return ${numericText};`,
      };
    }

    return {
      type: "ok",
      value: `return ${numericText};`,
    };
  }

  return {
    type: "err",
    error: buildCompileError(
      tuffSource,
      "Syntax error",
      "Check the syntax of your Tuff code and try again.",
    ),
  };
}
