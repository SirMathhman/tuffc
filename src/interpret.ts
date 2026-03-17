interface Token {
  type: "number" | "operator" | "eof";
  value: number | string;
}

class Tokenizer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return { type: "eof", value: "" };
    }

    const ch = this.input[this.pos];

    // Check for operator
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      this.pos++;
      return { type: "operator", value: ch };
    }

    // Check for number
    if (/\d/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.input.length && /\d/.test(this.input[this.pos])) {
        this.pos++;
      }
      // Skip type suffix (e.g., I64, U8, etc.)
      while (
        this.pos < this.input.length &&
        /[a-zA-Z0-9]/.test(this.input[this.pos])
      ) {
        this.pos++;
      }
      const value = parseInt(
        this.input.substring(start, this.pos).match(/^\d+/)![0],
        10,
      );
      return { type: "number", value };
    }

    throw new Error(`Unexpected character: '${ch}' at position ${this.pos}`);
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }
}

class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;

  constructor(input: string) {
    const tokenizer = new Tokenizer(input);
    while (true) {
      const token = tokenizer.nextToken();
      this.tokens.push(token);
      if (token.type === "eof") break;
    }
  }

  parse(): number {
    if (
      this.tokens.length === 0 ||
      (this.tokens.length === 1 && this.tokens[0].type === "eof")
    ) {
      return 0;
    }
    const result = this.parseAdditive();
    if (this.currentToken().type !== "eof") {
      throw new Error("Unexpected token after expression");
    }
    return result;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (
      this.currentToken().type === "operator" &&
      (this.currentToken().value === "+" || this.currentToken().value === "-")
    ) {
      const op = this.currentToken().value as string;
      this.advance();
      const right = this.parseMultiplicative();
      if (op === "+") {
        left = left + right;
      } else {
        left = left - right;
      }
    }

    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parsePrimary();

    while (
      this.currentToken().type === "operator" &&
      (this.currentToken().value === "*" || this.currentToken().value === "/")
    ) {
      const op = this.currentToken().value as string;
      this.advance();
      const right = this.parsePrimary();
      if (op === "*") {
        left = left * right;
      } else {
        if (right === 0) {
          throw new Error("Division by zero");
        }
        left = left / right;
      }
    }

    return left;
  }

  private parsePrimary(): number {
    const token = this.currentToken();
    if (token.type === "number") {
      this.advance();
      return token.value as number;
    }
    throw new Error(`Expected number, got ${token.type}`);
  }

  private currentToken(): Token {
    return this.tokens[this.pos];
  }

  private advance() {
    this.pos++;
  }
}

export function interpret(input: string): number {
  // Empty string returns 0
  if (input === "") {
    return 0;
  }

  const parser = new Parser(input);
  return parser.parse();
}
