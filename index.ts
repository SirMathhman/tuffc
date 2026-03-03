export function compile(source: string): string {
  // Empty input returns 0
  if (source === "") {
    return "return 0";
  }

  // Invalid input throws error
  if (/^[a-zA-Z_]/.test(source)) {
    throw new Error("Invalid input");
  }

  throw new Error("Not implemented yet");
}
