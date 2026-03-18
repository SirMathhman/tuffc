const TYPE_RANGES: Record<string, { min: number; max: number }> = {
  U8: { min: 0, max: 255 },
  U16: { min: 0, max: 65535 },
  U32: { min: 0, max: 4294967295 },
  U64: { min: 0, max: 18446744073709551615 },
  I8: { min: -128, max: 127 },
  I16: { min: -32768, max: 32767 },
  I32: { min: -2147483648, max: 2147483647 },
  I64: { min: -9223372036854775808, max: 9223372036854775807 },
};

type Token =
  | { type: "number"; value: number; typeStr: string }
  | { type: "operator"; op: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "eof" };

type ASTNode = {
  value: number;
  typeStr: string;
  operator?: "+" | "-" | "*" | "/";
  left?: ASTNode;
  right?: ASTNode;
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const consumeWhile = (pattern: RegExp): string => {
    let result = "";
    while (pos < input.length && pattern.test(input[pos])) {
      result += input[pos];
      pos++;
    }
    return result;
  };

  while (pos < input.length) {
    const ch = input[pos];

    // Skip whitespace
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: "lparen" });
      pos++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      pos++;
      continue;
    }

    // Operators
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "operator", op: ch as "+" | "-" | "*" | "/" });
      pos++;
      continue;
    }

    // Number with type suffix
    if (/\d/.test(ch)) {
      const numStr = consumeWhile(/\d/);
      const typeStr = consumeWhile(/[A-Za-z0-9]/);

      const value = parseInt(numStr, 10);
      if (!TYPE_RANGES[typeStr]) {
        throw new Error("Unknown type: " + typeStr);
      }

      // Validate single number within its type range
      const range = TYPE_RANGES[typeStr];
      if (value < range.min || value > range.max) {
        throw new Error(
          "Value " +
            value +
            " is out of range for type " +
            typeStr +
            " (" +
            range.min +
            " to " +
            range.max +
            ")",
        );
      }

      tokens.push({ type: "number", value, typeStr });
      continue;
    }

    throw new Error("Unexpected character: " + ch);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

function getWidestType(type1: string, type2: string): string {
  const typeOrder: Record<string, number> = {
    U8: 1,
    U16: 2,
    U32: 3,
    U64: 4,
    I8: 1,
    I16: 2,
    I32: 3,
    I64: 4,
  };

  const isUnsigned1 = type1[0] === "U";
  const isUnsigned2 = type2[0] === "U";

  // If both signed or both unsigned, use the larger one
  if (isUnsigned1 === isUnsigned2) {
    return typeOrder[type1] >= typeOrder[type2] ? type1 : type2;
  }

  // Mixed: upgrade to U64 if necessary
  if (type1 === "I64" || type2 === "I64") {
    throw new Error("Cannot safely combine I64 with unsigned types");
  }

  // For mixed signed/unsigned up to I32, use U64
  return "U64";
}

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private currentToken(): Token {
    return this.tokens[this.pos] || { type: "eof" };
  }

  private advance(): void {
    this.pos++;
  }

  private expect(type: string): Token {
    const token = this.currentToken();
    if (token.type !== type) {
      throw new Error("Unexpected token: " + token.type);
    }
    this.advance();
    return token;
  }

  parse(): ASTNode {
    return this.parseAdditive();
  }

  private parseAdditive(): ASTNode {
    return this.parseBinary(
      () => this.parseMultiplicative(),
      (op: string) => op === "+" || op === "-",
    );
  }

  private parseMultiplicative(): ASTNode {
    return this.parseBinary(
      () => this.parsePrimary(),
      (op: string) => op === "*" || op === "/",
    );
  }

  private parseBinary(
    parseNext: () => ASTNode,
    isOperator: (op: string) => boolean,
  ): ASTNode {
    let left = parseNext();

    while (this.currentToken().type === "operator") {
      const token = this.currentToken() as Token & { type: "operator" };
      if (!isOperator(token.op)) {
        break;
      }
      const op = token.op;
      this.advance();
      const right = parseNext();
      left = { value: 0, typeStr: "", operator: op, left, right };
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.currentToken();

    if (token.type === "number") {
      const numToken = token as Token & { type: "number" };
      this.advance();
      return {
        value: numToken.value,
        typeStr: numToken.typeStr,
      };
    }

    if (token.type === "lparen") {
      this.advance();
      const node = this.parseAdditive();
      this.expect("rparen");
      return node;
    }

    throw new Error("Unexpected token: " + token.type);
  }
}

function evaluate(node: ASTNode): { value: number; typeStr: string } {
  if (!node.operator) {
    // Leaf node
    return { value: node.value, typeStr: node.typeStr };
  }

  const left = evaluate(node.left!);
  const right = evaluate(node.right!);

  // Determine result type (widest of the two operands)
  const resultType = getWidestType(left.typeStr, right.typeStr);
  const typeRange = TYPE_RANGES[resultType];

  let result: number;

  switch (node.operator) {
    case "+":
      result = left.value + right.value;
      break;
    case "-":
      result = left.value - right.value;
      break;
    case "*":
      result = left.value * right.value;
      break;
    case "/":
      if (right.value === 0) {
        throw new Error("Division by zero");
      }
      result = Math.floor(left.value / right.value);
      break;
    default:
      throw new Error("Unknown operator: " + node.operator);
  }

  // Validate result fits in result type
  if (result < typeRange.min || result > typeRange.max) {
    throw new Error(
      "Result " +
        result +
        " is out of range for type " +
        resultType +
        " (" +
        typeRange.min +
        " to " +
        typeRange.max +
        ")",
    );
  }

  return { value: result, typeStr: resultType };
}

export function interpretTuff(input: string): number {
  if (input === "") {
    return 0;
  }

  // Reject leading negative sign (not part of expression syntax)
  if (input.trim().startsWith("-")) {
    throw new Error("Negative numbers are not allowed");
  }

  // Tokenize input
  const tokens = tokenize(input.trim());

  // Parse tokens into AST
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // Evaluate AST
  const result = evaluate(ast);

  return result.value;
}
