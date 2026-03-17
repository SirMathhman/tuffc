/**
 * Compiles Tuff source code into JavaScript source code.
 * This is intentionally stubbed for now.
 */
type IntegerType = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

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

function parseTypedLiteral(term: string): { value: number } {
  const typedLiteralMatch = term.match(
    /^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/,
  )!;

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

function parseReadTerm(term: string): IntegerType {
  const readMatch = term.match(/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/)!;

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

type Token =
  | { kind: "literal"; value: string }
  | { kind: "read"; value: string }
  | { kind: "operator"; value: "+" | "-" | "*" | "/" | "%" }
  | { kind: "lparen" }
  | { kind: "rparen" };

type EvalResult = { value: number; sourceType?: IntegerType };

function throwUnknownTokenError(chunk: string): never {
  if (chunk.endsWith("U8")) {
    throw new Error("Invalid U8 literal");
  }

  throw new Error("Invalid Tuff source");
}

function tokenizeExpression(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const remainder = source.slice(index);

    const whitespaceMatch = remainder.match(/^\s+/);
    if (whitespaceMatch) {
      index += whitespaceMatch[0].length;
      continue;
    }

    const previousToken = tokens[tokens.length - 1];
    const canStartSignedLiteral =
      !previousToken ||
      previousToken.kind === "operator" ||
      previousToken.kind === "lparen";

    const readMatch = remainder.match(
      /^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)/,
    );
    if (readMatch) {
      tokens.push({ kind: "read", value: readMatch[0] });
      index += readMatch[0].length;
      continue;
    }

    if (canStartSignedLiteral) {
      const signedLiteralMatch = remainder.match(
        /^-[0-9]+(U8|U16|U32|U64|I8|I16|I32|I64)/,
      );
      if (signedLiteralMatch) {
        tokens.push({ kind: "literal", value: signedLiteralMatch[0] });
        index += signedLiteralMatch[0].length;
        continue;
      }
    }

    const literalMatch = remainder.match(
      /^[0-9]+(U8|U16|U32|U64|I8|I16|I32|I64)/,
    );
    if (literalMatch) {
      tokens.push({ kind: "literal", value: literalMatch[0] });
      index += literalMatch[0].length;
      continue;
    }

    const char = source[index];
    if (
      char === "+" ||
      char === "-" ||
      char === "*" ||
      char === "/" ||
      char === "%"
    ) {
      tokens.push({ kind: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "lparen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "rparen" });
      index += 1;
      continue;
    }

    const unknownChunkMatch = remainder.match(/^[^\s()+\-*/%]+/)!;
    throwUnknownTokenError(unknownChunkMatch[0]);
  }

  return tokens;
}

function evaluateExpression(source: string, stdIn: string): number {
  const tokens = tokenizeExpression(source);
  const inputTokens = stdIn.trim().length > 0 ? stdIn.trim().split(/\s+/) : [];

  let tokenIndex = 0;
  let inputTokenIndex = 0;

  const peek = (): Token | undefined => tokens[tokenIndex];
  const consume = (): Token => {
    const token = tokens[tokenIndex];
    if (!token) {
      throw new Error("Invalid Tuff source");
    }

    tokenIndex += 1;
    return token;
  };

  const evaluatePrimary = (): EvalResult => {
    const token = peek();
    if (!token) {
      throw new Error("Invalid Tuff source");
    }

    if (token.kind === "literal") {
      consume();
      const parsed = parseTypedLiteral(token.value);
      const typeMatch = token.value.match(/(U8|U16|U32|U64|I8|I16|I32|I64)$/);
      const sourceType = typeMatch?.[1] as IntegerType | undefined;
      return { value: parsed.value, sourceType };
    }

    if (token.kind === "read") {
      consume();
      const integerType = parseReadTerm(token.value);
      const inputToken = inputTokens[inputTokenIndex] ?? "";
      inputTokenIndex += 1;
      return {
        value: parseTypedStdInToken(inputToken, integerType),
        sourceType: integerType,
      };
    }

    if (token.kind === "lparen") {
      consume();
      const value = evaluateAddSub();
      const closing = consume();
      if (closing.kind !== "rparen") {
        throw new Error("Invalid Tuff source");
      }

      return { value: value.value };
    }

    throw new Error("Invalid Tuff source");
  };

  const evaluateUnary = (): EvalResult => {
    const token = peek();
    if (token?.kind === "operator" && token.value === "-") {
      consume();
      const inner = evaluateUnary();
      return { value: -inner.value };
    }

    return evaluatePrimary();
  };

  const evaluateMulDivMod = (): EvalResult => {
    let left = evaluateUnary();

    while (true) {
      const token = peek();
      if (
        !token ||
        token.kind !== "operator" ||
        !["*", "/", "%"].includes(token.value)
      ) {
        return left;
      }

      consume();
      const right = evaluateUnary();

      if (token.value === "*") {
        left = { value: left.value * right.value };
      } else if (token.value === "/") {
        left = { value: Math.trunc(left.value / right.value) };
      } else {
        left = { value: left.value % right.value };
      }
    }
  };

  const evaluateAddSub = (): EvalResult => {
    let left = evaluateMulDivMod();

    while (true) {
      const token = peek();
      if (
        !token ||
        token.kind !== "operator" ||
        (token.value !== "+" && token.value !== "-")
      ) {
        return left;
      }

      consume();
      const right = evaluateMulDivMod();

      if (token.value === "+") {
        left = { value: left.value + right.value };
      } else {
        left = { value: left.value - right.value };
      }
    }
  };

  const result = evaluateAddSub();
  if (tokenIndex !== tokens.length) {
    throw new Error("Invalid Tuff source");
  }

  return result.value;
}

export function compileTuff(source: string, stdIn: string = ""): string {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return "(() => 0)()";
  }

  const value = evaluateExpression(trimmed, stdIn);
  return `(() => ${value})()`;
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
