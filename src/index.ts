export function interpret(input: string): number {
  if (input === "") {
    return 0;
  }
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) {
    throw new Error("Not implemented");
  }
  return parsed;
}
