export function compile(source: string): string {
  // Empty input returns 0
  if (source === "") {
    return "return 0";
  }

  // Numeric literals with optional type suffixes (e.g., 100U8, 100I32)
  const numMatch = /^(\d+)(?:[UI]\d{1,2})?$/.test(source);
  if (numMatch) {
    const numValue = source.replace(/[UI]\d{1,2}$/, "");
    return `return ${numValue}`;
  }

  // Invalid input throws error
  if (/^[a-zA-Z_]/.test(source)) {
    throw new Error("Invalid input");
  }

  throw new Error("Not implemented yet");
}
