export function interpretTuff(input: string): number {
  if (input === "") {
    return 0;
  }

  const parser = new TuffParser(input);
  const result = parser.parseExpression();
  parser.expectEnd();
  return result;
}

class TuffParser {
  private readonly input: string;
  private index = 0;

  constructor(input: string) {
    this.input = input;
  }

  parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "+" && operator !== "-") {
        return value;
      }

      this.index++;
      const rhs = this.parseTerm();
      value = operator === "+" ? value + rhs : value - rhs;
    }
  }

  parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "*" && operator !== "/") {
        return value;
      }

      this.index++;
      const rhs = this.parseFactor();

      if (operator === "*") {
        value *= rhs;
      } else {
        if (rhs === 0) {
          throw new Error("Division by zero");
        }
        value /= rhs;
      }
    }
  }

  parseFactor(): number {
    this.skipWhitespace();

    const char = this.peek();
    if (char === "-") {
      this.index++;
      return -this.parseFactor();
    }

    if (char === "(") {
      this.index++;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ")") {
        throw new Error("Unsupported Tuff input");
      }
      this.index++;
      return value;
    }

    return this.parseLiteral();
  }

  parseLiteral(): number {
    this.skipWhitespace();
    const start = this.index;

    if (this.peek() === "-") {
      this.index++;
    }

    while (this.isDigit(this.peek())) {
      this.index++;
    }

    const numericPart = this.input.slice(start, this.index);
    const suffix = this.readOptionalSuffix();
    if (!suffix) {
      if (numericPart === "" || numericPart === "-") {
        throw new Error("Unsupported Tuff input");
      }

      return Number(numericPart);
    }

    const match = `${numericPart}${suffix}`.match(/^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/);
    if (!match) {
      throw new Error("Unsupported Tuff input");
    }

    const value = BigInt(match[1]);
    const limits: Record<string, { min: bigint; max: bigint }> = {
      U8: { min: 0n, max: 255n },
      U16: { min: 0n, max: 65535n },
      U32: { min: 0n, max: 4294967295n },
      U64: { min: 0n, max: 18446744073709551615n },
      I8: { min: -128n, max: 127n },
      I16: { min: -32768n, max: 32767n },
      I32: { min: -2147483648n, max: 2147483647n },
      I64: { min: -9223372036854775808n, max: 9223372036854775807n },
    };

    const { min, max } = limits[match[2]];
    if (value < min || value > max) {
      throw new RangeError("Tuff integer literal out of range");
    }

    return Number(value);
  }

  expectEnd(): void {
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error("Unsupported Tuff input");
    }
  }

  private readOptionalSuffix(): string | undefined {
    const suffixes = ["U64", "I64", "U32", "I32", "U16", "I16", "U8", "I8"];
    for (const suffix of suffixes) {
      if (this.input.startsWith(suffix, this.index)) {
        this.index += suffix.length;
        return suffix;
      }
    }

    return undefined;
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) {
      this.index++;
    }
  }

  private peek(): string | undefined {
    this.skipWhitespace();
    return this.input[this.index];
  }

  private isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= "0" && char <= "9";
  }
}
