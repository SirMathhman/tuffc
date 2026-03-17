export function interpret(input: string): number {
  // Empty string returns 0
  if (input === "") {
    return 0;
  }

  // Extract leading digits
  const match = input.match(/^\d+/);
  if (!match) {
    throw new Error(`Invalid input: "${input}" does not start with a number`);
  }

  return parseInt(match[0], 10);
}
