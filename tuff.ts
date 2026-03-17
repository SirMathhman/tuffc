/**
 * Compiles Tuff source code into JavaScript source code.
 * This is intentionally stubbed for now.
 */
export function compileTuff(source: string, stdIn: string = ""): string {
  const trimmed = source.trim();
  const inputTokens = stdIn.trim().length > 0 ? stdIn.trim().split(/\s+/) : [];

  if (trimmed.length === 0) {
    return "(() => 0)()";
  }

  if (trimmed.includes("+")) {
    const terms = trimmed.split("+").map((term) => term.trim());
    let tokenIndex = 0;
    let sum = 0;

    for (const term of terms) {
      if (term === "read<U8>()") {
        const token = inputTokens[tokenIndex] ?? "";
        tokenIndex += 1;
        sum += Number(token);
        continue;
      }

      const termU8LiteralMatch = term.match(/^(\d+)U8$/);
      if (termU8LiteralMatch) {
        const value = Number(termU8LiteralMatch[1]);

        if (value > 255) {
          throw new Error("U8 literal out of range");
        }

        sum += value;
        continue;
      }

      if (/U8$/.test(term)) {
        throw new Error("Invalid U8 literal");
      }

      throw new Error("Invalid Tuff source");
    }

    return `(() => ${sum})()`;
  }

  const u8LiteralMatch = trimmed.match(/^(\d+)U8$/);
  if (u8LiteralMatch) {
    const value = Number(u8LiteralMatch[1]);

    if (value > 255) {
      throw new Error("U8 literal out of range");
    }

    return `(() => ${value})()`;
  }

  if (trimmed === "read<U8>()") {
    return `(() => Number(${JSON.stringify(inputTokens[0] ?? "")}))()`;
  }

  if (/U8$/.test(trimmed)) {
    throw new Error("Invalid U8 literal");
  }

  throw new Error("Invalid Tuff source");
}

/**
 * Compiles and executes Tuff source code, returning a numeric exit code.
 */
export function executeTuff(source: string, stdIn: string = ""): number {
  const compiledProgram = compileTuff(source, stdIn);

  // Run the compiled JavaScript and normalize the result to a number.
  const result = new Function(`return (${compiledProgram});`)();

  if (typeof result === "number" && Number.isFinite(result)) {
    return result;
  }

  return Number(result) || 0;
}
