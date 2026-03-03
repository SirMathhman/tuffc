export function compile(source: string): string {
  // Empty input returns 0
  if (source === "") {
    return "return 0";
  }

  // Numeric literals with optional type suffixes (e.g., 100U8, 100I32)
  if (isValidNumericLiteral(source)) {
    const numValue = stripTypeSuffix(source);
    return `return ${numValue}`;
  }

  // Invalid input throws error
  if (startsWithIdentifierChar(source)) {
    throw new Error("Invalid input");
  }

  throw new Error("Not implemented yet");
}

function isValidNumericLiteral(source: string): boolean {
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
}

function isValidTypeSuffix(suffix: string): boolean {
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
}

function stripTypeSuffix(source: string): string {
  // Remove type suffix if present
  let i = 0;
  while (i < source.length && source[i] >= "0" && source[i] <= "9") {
    i++;
  }
  return source.substring(0, i);
}

function startsWithIdentifierChar(source: string): boolean {
  if (!source.length) {
    return false;
  }
  const firstChar = source[0];
  return (
    (firstChar >= "a" && firstChar <= "z") ||
    (firstChar >= "A" && firstChar <= "Z") ||
    firstChar === "_"
  );
}
