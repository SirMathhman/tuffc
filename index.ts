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
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(trimmedSource)) {
    return {
      type: "ok",
      value: `return ${trimmedSource};`,
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
