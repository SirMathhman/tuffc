export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => {
  return { ok: true, value };
};

export const err = <E>(error: E): Result<never, E> => {
  return { ok: false, error };
};

export const compile = (source: string): Result<string, string> => {
  // Empty input returns 0
  if (source === "") {
    return ok("return 0");
  }

  // Numeric literals with optional type suffixes (e.g., 100U8, 100I32)
  // Must start with a digit
  if (source.length > 0 && source[0] >= "0" && source[0] <= "9") {
    let i = 0;
    while (i < source.length && source[i] >= "0" && source[i] <= "9") {
      i++;
    }
    const typeSuffix = source.substring(i);
    const validSuffix =
      typeSuffix.length === 0 ||
      (typeSuffix.length >= 2 &&
        typeSuffix.length <= 3 &&
        (typeSuffix[0] === "U" || typeSuffix[0] === "I") &&
        typeSuffix
          .split("")
          .slice(1)
          .every((c) => c >= "0" && c <= "9"));
    if (validSuffix) {
      return ok(`return ${source.substring(0, i)}`);
    }
  }

  // Invalid input returns error
  if (
    source.length > 0 &&
    ((source[0] >= "a" && source[0] <= "z") ||
      (source[0] >= "A" && source[0] <= "Z") ||
      source[0] === "_")
  ) {
    return err("Invalid input");
  }

  return err("Not implemented yet");
};
