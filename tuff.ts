/**
 * Compiles Tuff source code into JavaScript source code.
 * This is intentionally stubbed for now.
 */
type IntegerType = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

const INTEGER_TYPES: IntegerType[] = [
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
];

const INTEGER_RANGES: Record<IntegerType, { min: bigint; max: bigint }> = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

function parseTypedLiteral(term: string): { value: number } | null {
  const typedLiteralMatch = term.match(
    /^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/,
  );
  if (!typedLiteralMatch) {
    return null;
  }

  const [, numberPart, typePart] = typedLiteralMatch;
  const integerType = typePart as IntegerType;

  // Preserve previous behavior for U8 negatives.
  if (integerType === "U8" && numberPart.startsWith("-")) {
    throw new Error("Invalid U8 literal");
  }

  const value = BigInt(numberPart);
  const { min, max } = INTEGER_RANGES[integerType];

  if (value < min || value > max) {
    throw new Error(`${integerType} literal out of range`);
  }

  return { value: Number(value) };
}

function parseReadTerm(term: string): IntegerType | null {
  const readMatch = term.match(/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/);
  if (!readMatch) {
    return null;
  }

  return readMatch[1] as IntegerType;
}

function parseTypedStdInToken(token: string, integerType: IntegerType): number {
  if (!/^-?\d+$/.test(token)) {
    throw new Error("Invalid integer stdin");
  }

  const value = BigInt(token);
  const { min, max } = INTEGER_RANGES[integerType];
  if (value < min || value > max) {
    throw new Error("Invalid integer stdin");
  }

  return Number(value);
}

function isKnownTypedSuffix(term: string): boolean {
  return INTEGER_TYPES.some((type) => term.endsWith(type));
}

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
      const readType = parseReadTerm(term);
      if (readType) {
        const token = inputTokens[tokenIndex] ?? "";
        tokenIndex += 1;
        sum += parseTypedStdInToken(token, readType);
        continue;
      }

      const typedLiteral = parseTypedLiteral(term);
      if (typedLiteral) {
        sum += typedLiteral.value;
        continue;
      }

      if (isKnownTypedSuffix(term)) {
        if (term.endsWith("U8")) {
          throw new Error("Invalid U8 literal");
        }

        throw new Error("Invalid Tuff source");
      }

      throw new Error("Invalid Tuff source");
    }

    return `(() => ${sum})()`;
  }

  const typedLiteral = parseTypedLiteral(trimmed);
  if (typedLiteral) {
    return `(() => ${typedLiteral.value})()`;
  }

  const singleReadType = parseReadTerm(trimmed);
  if (singleReadType) {
    const firstToken = inputTokens[0] ?? "";
    const readValue = parseTypedStdInToken(firstToken, singleReadType);
    return `(() => ${readValue})()`;
  }

  if (isKnownTypedSuffix(trimmed)) {
    if (trimmed.endsWith("U8")) {
      throw new Error("Invalid U8 literal");
    }

    throw new Error("Invalid Tuff source");
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
  return Number(result) || 0;
}
