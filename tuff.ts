/**
 * Compiles Tuff source code into JavaScript source code.
 * This is intentionally stubbed for now.
 */
export function compileTuff(source: string): string {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return "(() => 0)()";
  }

  const u8LiteralMatch = trimmed.match(/^(\d+)U8$/);
  if (u8LiteralMatch) {
    const value = Number(u8LiteralMatch[1]);

    if (value > 255) {
      throw new Error("U8 literal out of range");
    }

    return `(() => ${value})()`;
  }

  if (/U8$/.test(trimmed)) {
    throw new Error("Invalid U8 literal");
  }

  // Stub output: a JavaScript program that evaluates to a numeric exit code.
  return "(() => 0)()";
}

/**
 * Compiles and executes Tuff source code, returning a numeric exit code.
 */
export function executeTuff(source: string): number {
  const compiledProgram = compileTuff(source);

  // Run the compiled JavaScript and normalize the result to a number.
  const result = new Function(`return (${compiledProgram});`)();

  if (typeof result === "number" && Number.isFinite(result)) {
    return result;
  }

  return Number(result) || 0;
}
