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
  // Accepts integer and float forms with optional `U8` integer suffix.
  const numericSuffixMatch = trimmedSource.match(
    /^([0-9]+(?:\.[0-9]+)?)(U8)?$/,
  );
  if (numericSuffixMatch) {
    const numericText = numericSuffixMatch[1];
    const suffix = numericSuffixMatch[2] ?? "";

    if (suffix === "U8") {
      if (!/^[0-9]+$/.test(numericText)) {
        // U8 requires integer literal only.
        return {
          type: "err",
          error: {
            invalidSource: tuffSource,
            message: "Compilation failed",
            reason: "Syntax error",
            fix: "Check the syntax of your Tuff code and try again.",
          },
        };
      }

      const value = Number(numericText);
      if (value < 0 || value > 255) {
        return {
          type: "err",
          error: {
            invalidSource: tuffSource,
            message: "Compilation failed",
            reason: "Value out of range for U8",
            fix: "Use a value between 0 and 255 for U8 literals.",
          },
        };
      }
    }

    return {
      type: "ok",
      value: `return ${numericText};`,
    };
  }

  return {
    type: "err",
    error: {
      invalidSource: tuffSource,
      message: "Compilation failed",
      reason: "Syntax error",
      fix: "Check the syntax of your Tuff code and try again.",
    },
  };
}
