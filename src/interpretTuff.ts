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
  | { type: "semicolon" }
  | { type: "colon" }
  | { type: "equals" }
  | { type: "let" }
  | { type: "mut" }
  | { type: "identifier"; name: string }
  | { type: "eof" };

type ASTNode =
  | {
      nodeType: "binary";
      operator: "+" | "-" | "*" | "/";
      left: ASTNode;
      right: ASTNode;
    }
  | {
      nodeType: "number";
      value: number;
      typeStr: string;
    }
  | {
      nodeType: "identifier";
      name: string;
    }
  | {
      nodeType: "let";
      varName: string;
      init: ASTNode;
      isMutable: boolean;
      explicitType?: string;
      body: ASTNode;
    }
  | {
      nodeType: "assignment";
      varName: string;
      value: ASTNode;
      body: ASTNode;
    }
  | {
      nodeType: "sequence";
      statements: ASTNode[];
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

    // Semicolon
    if (ch === ";") {
      tokens.push({ type: "semicolon" });
      pos++;
      continue;
    }

    // Colon
    if (ch === ":") {
      tokens.push({ type: "colon" });
      pos++;
      continue;
    }

    // Equals
    if (ch === "=") {
      tokens.push({ type: "equals" });
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

    // Keywords and identifiers
    if (/[a-zA-Z_]/.test(ch)) {
      const ident = consumeWhile(/[a-zA-Z0-9_]/);
      if (ident === "let") {
        tokens.push({ type: "let" });
      } else if (ident === "mut") {
        tokens.push({ type: "mut" });
      } else {
        tokens.push({ type: "identifier", name: ident });
      }
      continue;
    }

    // Number with type suffix (or just identifier like U8 after a number)
    if (/\d/.test(ch)) {
      const numStr = consumeWhile(/\d/);
      const typeStr = consumeWhile(/[A-Za-z0-9]/);

      const value = parseInt(numStr, 10);
      if (!TYPE_RANGES[typeStr]) {
        throw new Error("Unknown type: " + typeStr);
      }

      // Validate single number within its type range
      validateValueInRange(
        value,
        typeStr,
        TYPE_RANGES[typeStr].min + " to " + TYPE_RANGES[typeStr].max,
      );

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

  private peekNextToken(): Token {
    return this.tokens[this.pos + 1] || { type: "eof" };
  }

  private advance(): void {
    this.pos++;
  }

  private expect(type: string): Token {
    const token = this.currentToken();
    if (token.type !== type) {
      throw new Error(
        "Unexpected token: expected " + type + ", got " + token.type,
      );
    }
    this.advance();
    return token;
  }

  parse(): ASTNode {
    return this.parseStatementSequence();
  }

  private parseStatementSequence(): ASTNode {
    const statements: ASTNode[] = [];

    while (this.currentToken().type !== "eof") {
      statements.push(this.parseStatement());
    }

    if (statements.length === 1) {
      return statements[0];
    }
    return { nodeType: "sequence", statements };
  }

  private parseStatement(): ASTNode {
    if (this.currentToken().type === "let") {
      return this.parseLetStatement();
    }

    if (
      this.currentToken().type === "identifier" &&
      this.peekNextToken().type === "equals"
    ) {
      return this.parseAssignmentStatement();
    }

    const statement = this.parseAdditive();
    if (this.currentToken().type === "semicolon") {
      this.advance();
    }
    return statement;
  }

  private parseLetStatement(): ASTNode {
    this.expect("let");

    // Check for mut keyword
    let isMutable = false;
    if (this.currentToken().type === "mut") {
      isMutable = true;
      this.advance();
    }

    // Parse variable name
    const nameToken = this.expect("identifier");
    const varName = (nameToken as Token & { type: "identifier" }).name;

    // Parse optional type annotation
    let explicitType: string | undefined;
    if (this.currentToken().type === "colon") {
      this.advance();
      const typeToken = this.expect("identifier");
      explicitType = (typeToken as Token & { type: "identifier" }).name;
    }

    // Parse initializer
    this.expect("equals");
    const init = this.parseAdditive();

    // Parse semicolon
    this.expect("semicolon");

    // Parse the body (rest of the statements)
    const body = this.parseStatementSequence();

    return {
      nodeType: "let",
      varName,
      init,
      isMutable,
      explicitType,
      body,
    };
  }

  private parseAssignmentStatement(): ASTNode {
    // Parse variable name
    const nameToken = this.expect("identifier");
    const varName = (nameToken as Token & { type: "identifier" }).name;

    // Parse equals
    this.expect("equals");

    // Parse value
    const value = this.parseAdditive();

    // Parse semicolon
    this.expect("semicolon");

    // Parse the body (rest of the statements)
    const body = this.parseStatementSequence();

    return {
      nodeType: "assignment",
      varName,
      value,
      body,
    };
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
      left = { nodeType: "binary", operator: op, left, right };
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.currentToken();

    if (token.type === "number") {
      const numToken = token as Token & { type: "number" };
      this.advance();
      return {
        nodeType: "number",
        value: numToken.value,
        typeStr: numToken.typeStr,
      };
    }

    if (token.type === "identifier") {
      const idToken = token as Token & { type: "identifier" };
      this.advance();
      return {
        nodeType: "identifier",
        name: idToken.name,
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

type Environment = Map<
  string,
  { value: number; typeStr: string; isMutable: boolean }
>;

function validateValueInRange(
  value: number,
  typeStr: string,
  context?: string,
): void {
  const typeRange = TYPE_RANGES[typeStr];
  if (value < typeRange.min || value > typeRange.max) {
    throw new Error(
      "Value " +
        value +
        " is out of range for type " +
        typeStr +
        (context ? " (" + context + ")" : ""),
    );
  }
}

function getOrThrowBinding(
  varName: string,
  env: Environment,
): { value: number; typeStr: string; isMutable: boolean } {
  const binding = env.get(varName);
  if (!binding) {
    throw new Error("Undefined variable: " + varName);
  }
  return binding;
}

function evaluate(
  node: ASTNode,
  env: Environment,
): { value: number; typeStr: string } {
  switch (node.nodeType) {
    case "number":
      return { value: node.value, typeStr: node.typeStr };

    case "identifier": {
      return getOrThrowBinding(node.name, env);
    }

    case "binary": {
      const left = evaluate(node.left, env);
      const right = evaluate(node.right, env);

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

    case "let": {
      // Evaluate the initializer in the current environment
      const initValue = evaluate(node.init, env);

      // Determine the actual type (explicit type annotation or inferred)
      const varType = node.explicitType || initValue.typeStr;

      // If explicit type is given, validate that the init value fits
      if (node.explicitType) {
        validateValueInRange(initValue.value, node.explicitType);
      }

      // Create a new environment with the bound variable
      const newEnv = new Map(env);
      newEnv.set(node.varName, {
        value: initValue.value,
        typeStr: varType,
        isMutable: node.isMutable,
      });

      // Evaluate the body in the new environment
      return evaluate(node.body, newEnv);
    }

    case "assignment": {
      // Look up the variable
      const binding = getOrThrowBinding(node.varName, env);

      // Check that the variable is mutable
      if (!binding.isMutable) {
        throw new Error("Cannot assign to immutable variable: " + node.varName);
      }

      // Evaluate the value in the current environment
      const newValue = evaluate(node.value, env);

      // Validate the new value fits in the variable's type
      validateValueInRange(newValue.value, binding.typeStr);

      // Create a new environment with the updated variable
      const newEnv = new Map(env);
      newEnv.set(node.varName, {
        value: newValue.value,
        typeStr: binding.typeStr,
        isMutable: binding.isMutable,
      });

      // Evaluate the body in the new environment
      return evaluate(node.body, newEnv);
    }

    case "sequence": {
      let result: { value: number; typeStr: string } = {
        value: 0,
        typeStr: "U8",
      };
      for (const stmt of node.statements) {
        result = evaluate(stmt, env);
      }
      return result;
    }
  }
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

  // Evaluate AST with empty initial environment
  const result = evaluate(ast, new Map());

  return result.value;
}
