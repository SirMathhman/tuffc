console.log("Hello via Bun!");

export function interpretTuff(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") {
    return 0;
  }

  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid Tuff input: ${input}`);
  }

  return value;
}
