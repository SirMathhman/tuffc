type TuffType =
  | "Number"
  | "U8"
  | "U16"
  | "U32"
  | "U64"
  | "I8"
  | "I16"
  | "I32"
  | "I64";

interface TuffValue {
  value: number;
  type: TuffType;
}

const INTEGER_TYPES = [
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
] as const;

const TYPE_LIMITS: Record<
  Exclude<TuffType, "Number">,
  { min: bigint; max: bigint }
> = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

export function interpretTuff(input: string): number {
  if (input === "") {
    return 0;
  }

  const parser = new TuffParser(input);
  const result = parser.parseProgram();
  parser.expectEnd();
  return result.value;
}

class TuffParser {
  private readonly input: string;
  private readonly environment = new Map<string, TuffValue>();
  private index = 0;

  constructor(input: string) {
    this.input = input;
  }

  parseProgram(): TuffValue {
    let result: TuffValue | null = null;

    while (true) {
      this.skipWhitespace();

      if (this.isAtEnd()) {
        break;
      }

      if (this.matchKeyword("let")) {
        this.parseLetStatement();
        this.skipWhitespace();
        if (!this.consume(";")) {
          throw new Error("Unsupported Tuff input");
        }
        continue;
      }

      result = this.parseExpression();
      this.skipWhitespace();

      if (this.consume(";")) {
        continue;
      }

      break;
    }

    if (result === null) {
      throw new Error("Unsupported Tuff input");
    }

    return result;
  }

  parseExpression(): TuffValue {
    let value = this.parseTerm();

    while (true) {
      this.skipWhitespace();
      const operator = this.peekRaw();
      if (operator !== "+" && operator !== "-") {
        return value;
      }

      this.index++;
      const rhs = this.parseTerm();
      value = this.applyArithmetic(operator, value, rhs);
    }
  }

  parseTerm(): TuffValue {
    let value = this.parseFactor();

    while (true) {
      this.skipWhitespace();
      const operator = this.peekRaw();
      if (operator !== "*" && operator !== "/") {
        return value;
      }

      this.index++;
      const rhs = this.parseFactor();

      if (operator === "/" && rhs.value === 0) {
        throw new Error("Division by zero");
      }

      const nextValue =
        operator === "*" ? value.value * rhs.value : value.value / rhs.value;
      value = {
        value: nextValue,
        type: this.resultTypeForArithmetic(value, rhs),
      };
    }
  }

  parseFactor(): TuffValue {
    this.skipWhitespace();

    const char = this.peekRaw();
    if (char === "-") {
      this.index++;
      const value = this.parseFactor();
      return { value: -value.value, type: value.type };
    }

    if (char === "(") {
      this.index++;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.peekRaw() !== ")") {
        throw new Error("Unsupported Tuff input");
      }
      this.index++;
      return value;
    }

    if (this.isDigit(char)) {
      return this.parseNumericLiteral();
    }

    if (this.isIdentifierStart(char)) {
      return this.parseIdentifier();
    }

    throw new Error("Unsupported Tuff input");
  }

  parseLetStatement(): void {
    const name = this.readIdentifier();
    this.skipWhitespace();
    this.expectChar(":");
    const declaredType = this.readTypeName();
    this.expectChar("=");
    const rhs = this.parseExpression();

    this.assertAssignable(declaredType, rhs);
    this.environment.set(name, { value: rhs.value, type: declaredType });
  }

  parseNumericLiteral(): TuffValue {
    const start = this.index;
    while (this.isDigit(this.peekRaw())) {
      this.index++;
    }

    const digits = this.input.slice(start, this.index);
    const literalSuffix = this.readOptionalSuffix();

    if (!literalSuffix) {
      return { value: Number(digits), type: "Number" };
    }

    const literal = `${digits}${literalSuffix}`;
    const match = literal.match(/^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/);
    if (!match) {
      throw new Error("Unsupported Tuff input");
    }

    const value = BigInt(match[1]);
    const typedSuffix = match[2] as Exclude<TuffType, "Number">;
    const { min, max } = TYPE_LIMITS[typedSuffix];
    if (value < min || value > max) {
      throw new RangeError("Tuff integer literal out of range");
    }

    return { value: Number(value), type: typedSuffix };
  }

  parseIdentifier(): TuffValue {
    const name = this.readIdentifier();
    const value = this.environment.get(name);
    if (value === undefined) {
      throw new Error("Unsupported Tuff input");
    }

    return value;
  }

  expectEnd(): void {
    this.skipWhitespace();
    if (!this.isAtEnd()) {
      throw new Error("Unsupported Tuff input");
    }
  }

  private applyArithmetic(
    operator: string,
    left: TuffValue,
    right: TuffValue,
  ): TuffValue {
    const value =
      operator === "+" ? left.value + right.value : left.value - right.value;

    return { value, type: this.resultTypeForArithmetic(left, right) };
  }

  private resultTypeForArithmetic(left: TuffValue, right: TuffValue): TuffType {
    if (left.type === right.type && left.type !== "Number") {
      return left.type;
    }

    return "Number";
  }

  private assertAssignable(
    targetType: Exclude<TuffType, "Number">,
    value: TuffValue,
  ): void {
    if (value.type !== "Number" && value.type !== targetType) {
      throw new Error("Unsupported Tuff input");
    }

    const numericValue = BigInt(Math.trunc(value.value));
    const { min, max } = TYPE_LIMITS[targetType];
    if (numericValue < min || numericValue > max) {
      throw new RangeError("Tuff integer literal out of range");
    }
  }

  private readTypeName(): Exclude<TuffType, "Number"> {
    const identifier = this.readIdentifier();
    if (!INTEGER_TYPES.includes(identifier as (typeof INTEGER_TYPES)[number])) {
      throw new Error("Unsupported Tuff input");
    }

    return identifier as Exclude<TuffType, "Number">;
  }

  private readOptionalSuffix(): string | undefined {
    for (const suffix of [
      "U64",
      "I64",
      "U32",
      "I32",
      "U16",
      "I16",
      "U8",
      "I8",
    ]) {
      if (this.input.startsWith(suffix, this.index)) {
        this.index += suffix.length;
        return suffix;
      }
    }

    return undefined;
  }

  private readIdentifier(): string {
    this.skipWhitespace();

    const start = this.index;
    if (!this.isIdentifierStart(this.peekRaw())) {
      throw new Error("Unsupported Tuff input");
    }

    this.index++;
    while (this.isIdentifierPart(this.peekRaw())) {
      this.index++;
    }

    return this.input.slice(start, this.index);
  }

  private matchKeyword(keyword: string): boolean {
    this.skipWhitespace();
    if (!this.input.startsWith(keyword, this.index)) {
      return false;
    }

    const next = this.input[this.index + keyword.length];
    if (this.isIdentifierPart(next)) {
      return false;
    }

    this.index += keyword.length;
    return true;
  }

  private expectChar(expected: string): void {
    this.skipWhitespace();
    if (this.peekRaw() !== expected) {
      throw new Error("Unsupported Tuff input");
    }

    this.index++;
  }

  private consume(expected: string): boolean {
    this.skipWhitespace();
    if (this.peekRaw() !== expected) {
      return false;
    }

    this.index++;
    return true;
  }

  private skipWhitespace(): void {
    while (
      this.index < this.input.length &&
      /\s/.test(this.input[this.index])
    ) {
      this.index++;
    }
  }

  private peekRaw(): string | undefined {
    return this.input[this.index];
  }

  private isAtEnd(): boolean {
    return this.index >= this.input.length;
  }

  private isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= "0" && char <= "9";
  }

  private isIdentifierStart(char: string | undefined): boolean {
    return (
      char !== undefined &&
      ((char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        char === "_")
    );
  }

  private isIdentifierPart(char: string | undefined): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }
}
