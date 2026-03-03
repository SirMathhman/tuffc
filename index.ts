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
  if (isValidNumericLiteral(source)) {
    const numValue = stripTypeSuffix(source);
    return ok(`return ${numValue}`);
  }

  // Invalid input returns error
  if (startsWithIdentifierChar(source)) {
    return err("Invalid input");
  }

  return err("Not implemented yet");
};

const isValidNumericLiteral = (source: string): boolean => {
  // Must start with a digit
  if (!source.length || source[0] < "0" || source[0] > "9") {
    return false;
  }

  let i = 0;
  // Consume digits
  while (i < source.length && source[i] >= "0" && source[i] <= "9") {
    i++;
  }

  // Check for type suffix (optional)
  if (i < source.length) {
    const typeSuffix = source.substring(i);
    return isValidTypeSuffix(typeSuffix);
  }

  return true;
};

const isValidTypeSuffix = (suffix: string): boolean => {
  // Match patterns like U8, I32, U64, etc.
  if (suffix.length < 2 || suffix.length > 3) {
    return false;
  }

  const typeChar = suffix[0];
  if (typeChar !== "U" && typeChar !== "I") {
    return false;
  }

  // Remaining characters must be digits
  for (let i = 1; i < suffix.length; i++) {
    if (suffix[i] < "0" || suffix[i] > "9") {
      return false;
    }
  }

  return true;
};

const stripTypeSuffix = (source: string): string => {
  // Remove type suffix if present
  let i = 0;
  while (i < source.length && source[i] >= "0" && source[i] <= "9") {
    i++;
  }
  return source.substring(0, i);
};

const startsWithIdentifierChar = (source: string): boolean => {
  if (!source.length) {
    return false;
  }
  const firstChar = source[0];
  return (
    (firstChar >= "a" && firstChar <= "z") ||
    (firstChar >= "A" && firstChar <= "Z") ||
    firstChar === "_"
  );
};
