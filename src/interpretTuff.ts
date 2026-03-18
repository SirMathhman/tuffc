const TYPE_RANGES: Record<string, { min: number; max: number }> = {
  Bool: { min: 0, max: 1 },
  U8: { min: 0, max: 255 },
  U16: { min: 0, max: 65535 },
  U32: { min: 0, max: 4294967295 },
  U64: { min: 0, max: 18446744073709551615 },
  I8: { min: -128, max: 127 },
  I16: { min: -32768, max: 32767 },
  I32: { min: -2147483648, max: 2147483647 },
  I64: { min: -9223372036854775808, max: 9223372036854775807 },
};

// Control flow exceptions for break and continue
class BreakException extends Error {
  constructor() {
    super("break");
  }
}

class ContinueException extends Error {
  constructor() {
    super("continue");
  }
}

class ReturnException extends Error {
  payload: { value: number; typeStr: string };

  constructor(payload: { value: number; typeStr: string }) {
    super("return");
    this.payload = payload;
  }
}

type Token =
  | { type: "number"; value: number; typeStr: string }
  | { type: "boolean"; value: boolean }
  | { type: "operator"; op: "+" | "-" | "*" | "/" }
  | { type: "logicalOperator"; op: "&&" | "||" }
  | { type: "comparisonOperator"; op: "==" | "!=" | "<" | "<=" | ">" | ">=" }
  | { type: "bang" }
  | { type: "lbrace" }
  | { type: "rbrace" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "semicolon" }
  | { type: "comma" }
  | { type: "colon" }
  | { type: "fatArrow" }
  | { type: "plusEquals" }
  | { type: "minusEquals" }
  | { type: "timesEquals" }
  | { type: "divideEquals" }
  | { type: "equals" }
  | { type: "if" }
  | { type: "else" }
  | { type: "while" }
  | { type: "break" }
  | { type: "continue" }
  | { type: "fn" }
  | { type: "return" }
  | { type: "let" }
  | { type: "mut" }
  | { type: "identifier"; name: string }
  | { type: "eof" };

type ASTNode =
  | {
      nodeType: "binary";
      operator:
        | "+"
        | "-"
        | "*"
        | "/"
        | "&&"
        | "||"
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">=";
      left: ASTNode;
      right: ASTNode;
    }
  | {
      nodeType: "unary";
      operator: "!";
      operand: ASTNode;
    }
  | {
      nodeType: "number";
      value: number;
      typeStr: string;
    }
  | {
      nodeType: "boolean";
      value: boolean;
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
      nodeType: "ifExpression";
      condition: ASTNode;
      thenBranch: ASTNode;
      elseBranch: ASTNode;
    }
  | {
      nodeType: "ifStatement";
      condition: ASTNode;
      thenBranch: ASTNode;
      elseBranch?: ASTNode;
      body: ASTNode;
    }
  | {
      nodeType: "functionDefinition";
      functionName: string;
      params: Array<{ name: string; typeStr: string }>;
      returnType?: string;
      rhsExpression: ASTNode;
      continueWith: ASTNode;
    }
  | {
      nodeType: "functionCall";
      functionName: string;
      args: ASTNode[];
    }
  | {
      nodeType: "returnStatement";
      value: ASTNode;
    }
  | {
      nodeType: "whileStatement";
      condition: ASTNode;
      body: ASTNode;
      continueWith: ASTNode;
    }
  | {
      nodeType: "break";
    }
  | {
      nodeType: "continue";
    }
  | {
      nodeType: "block";
      body?: ASTNode;
    }
  | {
      nodeType: "sequence";
      statements: ASTNode[];
    };

function nodeHasValue(node: ASTNode): boolean {
  switch (node.nodeType) {
    case "number":
    case "boolean":
    case "identifier":
    case "binary":
    case "unary":
    case "functionCall":
      return true;
    case "block":
      return node.body !== undefined;
    case "let":
    case "assignment":
      return nodeHasValue(node.body);
    case "ifExpression":
      return true;
    case "ifStatement":
      return nodeHasValue(node.body);
    case "whileStatement":
      return false;
    case "functionDefinition":
      return false;
    case "returnStatement":
      return false;
    case "break":
    case "continue":
      return false;
    case "sequence":
      return (
        node.statements.length > 0 &&
        nodeHasValue(node.statements[node.statements.length - 1]!)
      );
  }
}

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

    // Comparison operators
    if (input.slice(pos, pos + 2) === "==") {
      tokens.push({ type: "comparisonOperator", op: "==" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "!=") {
      tokens.push({ type: "comparisonOperator", op: "!=" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "<=") {
      tokens.push({ type: "comparisonOperator", op: "<=" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === ">=") {
      tokens.push({ type: "comparisonOperator", op: ">=" });
      pos += 2;
      continue;
    }

    // Logical operators
    if (input.slice(pos, pos + 2) === "&&") {
      tokens.push({ type: "logicalOperator", op: "&&" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "||") {
      tokens.push({ type: "logicalOperator", op: "||" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "+=") {
      tokens.push({ type: "plusEquals" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "-=") {
      tokens.push({ type: "minusEquals" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "*=") {
      tokens.push({ type: "timesEquals" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "/=") {
      tokens.push({ type: "divideEquals" });
      pos += 2;
      continue;
    }

    if (input.slice(pos, pos + 2) === "=>") {
      tokens.push({ type: "fatArrow" });
      pos += 2;
      continue;
    }

    if (ch === "<") {
      tokens.push({ type: "comparisonOperator", op: "<" });
      pos++;
      continue;
    }

    if (ch === ">") {
      tokens.push({ type: "comparisonOperator", op: ">" });
      pos++;
      continue;
    }

    // Unary not
    if (ch === "!") {
      tokens.push({ type: "bang" });
      pos++;
      continue;
    }

    // Semicolon
    if (ch === ";") {
      tokens.push({ type: "semicolon" });
      pos++;
      continue;
    }

    if (ch === ",") {
      tokens.push({ type: "comma" });
      pos++;
      continue;
    }

    if (ch === "{") {
      tokens.push({ type: "lbrace" });
      pos++;
      continue;
    }

    if (ch === "}") {
      tokens.push({ type: "rbrace" });
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
      } else if (ident === "if") {
        tokens.push({ type: "if" });
      } else if (ident === "else") {
        tokens.push({ type: "else" });
      } else if (ident === "while") {
        tokens.push({ type: "while" });
      } else if (ident === "break") {
        tokens.push({ type: "break" });
      } else if (ident === "continue") {
        tokens.push({ type: "continue" });
      } else if (ident === "fn") {
        tokens.push({ type: "fn" });
      } else if (ident === "return") {
        tokens.push({ type: "return" });
      } else if (ident === "mut") {
        tokens.push({ type: "mut" });
      } else if (ident === "true") {
        tokens.push({ type: "boolean", value: true });
      } else if (ident === "false") {
        tokens.push({ type: "boolean", value: false });
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

  private consumeOptionalSemicolon(): void {
    if (this.currentToken().type === "semicolon") {
      this.advance();
    }
  }

  private parseAmbiguousExpressionOrStatement(
    parseStatementFallback: () => ASTNode,
  ): ASTNode {
    const startPos = this.pos;

    try {
      const statement = this.parseExpression();
      this.consumeOptionalSemicolon();
      return statement;
    } catch {
      this.pos = startPos;
      const statement = parseStatementFallback();
      this.consumeOptionalSemicolon();
      return statement;
    }
  }

  private emptySequence(): ASTNode {
    return { nodeType: "sequence", statements: [] };
  }

  private isAssignmentStart(): boolean {
    return (
      this.currentToken().type === "identifier" &&
      (this.peekNextToken().type === "equals" ||
        this.peekNextToken().type === "plusEquals" ||
        this.peekNextToken().type === "minusEquals" ||
        this.peekNextToken().type === "timesEquals" ||
        this.peekNextToken().type === "divideEquals")
    );
  }

  private parseBindingStatement(
    kind: "let" | "assignment",
    standalone: boolean,
  ): ASTNode {
    const parser =
      kind === "let"
        ? standalone
          ? this.parseStandaloneLetStatement
          : this.parseLetStatement
        : standalone
          ? this.parseStandaloneAssignmentStatement
          : this.parseAssignmentStatement;

    return parser.call(this);
  }

  private parseNestedIfStatementBranch(): ASTNode {
    return this.parseStandaloneIfStatement();
  }

  private parseElseBranch(statementContext: boolean): ASTNode {
    const startsIf = this.currentToken().type === "if";

    if (!startsIf) {
      if (statementContext) {
        return this.parseStatementBranch();
      }

      return this.parseIfExpressionBranch();
    }

    if (statementContext) {
      return this.parseNestedIfStatementBranch();
    }

    return this.parseIfExpression();
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

  private tryParseWhileStatement(): ASTNode | null {
    if (this.currentToken().type !== "while") {
      return null;
    }
    return this.parseWhileStatement();
  }

  private consumeSemicolonAsPerContext(expectSemicolon: boolean): void {
    if (expectSemicolon) {
      this.expect("semicolon");
    } else {
      this.consumeOptionalSemicolon();
    }
  }

  private parseIdentifierName(): string {
    return (this.expect("identifier") as Token & { type: "identifier" }).name;
  }

  private parseFunctionStatementByContext(standalone: boolean): ASTNode {
    if (this.currentToken().type !== "fn") {
      throw new Error("Expected function definition");
    }

    return standalone
      ? this.parseStandaloneFunctionStatement()
      : this.parseFunctionStatement();
  }

  private parseBreakOrContinueStatement(
    expectSemicolon: boolean,
  ): ASTNode | null {
    const token = this.currentToken();
    if (token.type === "break") {
      this.advance();
      this.consumeSemicolonAsPerContext(expectSemicolon);
      return { nodeType: "break" };
    }
    if (token.type === "continue") {
      this.advance();
      this.consumeSemicolonAsPerContext(expectSemicolon);
      return { nodeType: "continue" };
    }
    return null;
  }

  private parseReturnStatement(expectSemicolon: boolean): ASTNode | null {
    if (this.currentToken().type !== "return") {
      return null;
    }

    this.advance();
    const value = this.parseExpression();
    this.consumeSemicolonAsPerContext(expectSemicolon);
    return { nodeType: "returnStatement", value };
  }

  parse(): ASTNode {
    return this.parseStatementSequence();
  }

  private parseExpression(): ASTNode {
    return this.parseLogicalOr();
  }

  private parseStatementSequence(): ASTNode {
    const statements: ASTNode[] = [];

    while (
      this.currentToken().type !== "eof" &&
      this.currentToken().type !== "rbrace"
    ) {
      statements.push(this.parseStatement());
    }

    if (statements.length === 1) {
      return statements[0];
    }
    return { nodeType: "sequence", statements };
  }

  private parseStatement(): ASTNode {
    if (this.currentToken().type === "fn") {
      return this.parseFunctionStatementByContext(false);
    }

    if (this.currentToken().type === "let") {
      return this.parseBindingStatement("let", false);
    }

    if (this.currentToken().type === "lbrace") {
      return this.parseAmbiguousExpressionOrStatement(() =>
        this.parseBlock(false),
      );
    }

    if (this.currentToken().type === "if") {
      return this.parseAmbiguousExpressionOrStatement(() =>
        this.parseIfStatement(),
      );
    }

    const whileStatement = this.tryParseWhileStatement();
    if (whileStatement !== null) {
      return whileStatement;
    }

    const breakOrContinue = this.parseBreakOrContinueStatement(false);
    if (breakOrContinue !== null) {
      return breakOrContinue;
    }

    const returnStatement = this.parseReturnStatement(false);
    if (returnStatement !== null) {
      return returnStatement;
    }

    if (this.isAssignmentStart()) {
      return this.parseBindingStatement("assignment", false);
    }

    const statement = this.parseExpression();
    this.consumeOptionalSemicolon();
    return statement;
  }

  private parseBlock(requireValue: boolean): ASTNode {
    this.expect("lbrace");

    const body = this.parseStatementSequence();

    this.expect("rbrace");

    if (body.nodeType === "sequence" && body.statements.length === 0) {
      if (requireValue) {
        throw new Error("Block expression requires a value");
      }
      return { nodeType: "block" };
    }

    if (requireValue && !nodeHasValue(body)) {
      throw new Error("Block expression requires a final value");
    }

    return { nodeType: "block", body };
  }

  private parseStandaloneLetStatement(): ASTNode {
    const declaration = this.parseLetBinding();
    this.expect("semicolon");

    return {
      nodeType: "let",
      ...declaration,
      body: this.emptySequence(),
    };
  }

  private parseStandaloneAssignmentStatement(): ASTNode {
    const assignment = this.parseAssignmentBinding();
    this.expect("semicolon");

    return {
      nodeType: "assignment",
      ...assignment,
      body: this.emptySequence(),
    };
  }

  private parseIfCondition(): ASTNode {
    this.expect("if");
    this.expect("lparen");
    const condition = this.parseExpression();
    this.expect("rparen");
    return condition;
  }

  private parseIfExpressionBranch(): ASTNode {
    if (this.currentToken().type === "lbrace") {
      return this.parseBlock(true);
    }

    return this.parseExpression();
  }

  private parseIfExpression(): ASTNode {
    const condition = this.parseIfCondition();
    const thenBranch = this.parseIfExpressionBranch();

    this.expect("else");

    const elseBranch = this.parseElseBranch(false);

    return {
      nodeType: "ifExpression",
      condition,
      thenBranch,
      elseBranch,
    };
  }

  private parseStatementBranch(): ASTNode {
    if (this.currentToken().type === "fn") {
      return this.parseFunctionStatementByContext(true);
    }

    if (this.currentToken().type === "lbrace") {
      return this.parseBlock(false);
    }

    if (this.currentToken().type === "if") {
      return this.parseNestedIfStatementBranch();
    }

    const whileStatement = this.tryParseWhileStatement();
    if (whileStatement !== null) {
      return whileStatement;
    }

    const breakOrContinue = this.parseBreakOrContinueStatement(true);
    if (breakOrContinue !== null) {
      return breakOrContinue;
    }

    const returnStatement = this.parseReturnStatement(true);
    if (returnStatement !== null) {
      return returnStatement;
    }

    if (this.currentToken().type === "let") {
      return this.parseBindingStatement("let", true);
    }

    if (this.isAssignmentStart()) {
      return this.parseBindingStatement("assignment", true);
    }

    const statement = this.parseExpression();
    this.expect("semicolon");
    return statement;
  }

  private parseIfStatementCore(): Omit<
    Extract<ASTNode, { nodeType: "ifStatement" }>,
    "body"
  > {
    const condition = this.parseIfCondition();
    const thenBranch = this.parseStatementBranch();

    let elseBranch: ASTNode | undefined;
    if (this.currentToken().type === "else") {
      this.advance();
      elseBranch = this.parseElseBranch(true);
    }

    return {
      nodeType: "ifStatement",
      condition,
      thenBranch,
      elseBranch,
    };
  }

  private parseIfStatementWithBody(bodyFactory: () => ASTNode): ASTNode {
    return {
      ...this.parseIfStatementCore(),
      body: bodyFactory(),
    };
  }

  private parseStandaloneIfStatement(): ASTNode {
    return this.parseIfStatementWithBody(() => this.emptySequence());
  }

  private parseIfStatement(): ASTNode {
    return this.parseIfStatementWithBody(() => this.parseStatementSequence());
  }

  private parseWhileStatement(): ASTNode {
    this.expect("while");
    this.expect("lparen");
    const condition = this.parseExpression();
    this.expect("rparen");

    const body = this.parseStatementBranch();
    const continueWith = this.parseStatementSequence();

    return {
      nodeType: "whileStatement",
      condition,
      body,
      continueWith,
    };
  }

  private parseFunctionParameters(): Array<{ name: string; typeStr: string }> {
    const params: Array<{ name: string; typeStr: string }> = [];

    if (this.currentToken().type === "rparen") {
      return params;
    }

    while (true) {
      const name = this.parseIdentifierName();
      this.expect("colon");
      const typeStr = this.parseIdentifierName();

      params.push({ name, typeStr });

      if (this.currentToken().type !== "comma") {
        break;
      }

      this.advance();
    }

    return params;
  }

  private parseFunctionDefinitionBinding(): Omit<
    Extract<ASTNode, { nodeType: "functionDefinition" }>,
    "continueWith" | "nodeType"
  > {
    this.expect("fn");

    const functionName = this.parseIdentifierName();

    this.expect("lparen");
    const params = this.parseFunctionParameters();
    this.expect("rparen");

    let returnType: string | undefined;
    if (this.currentToken().type === "colon") {
      this.advance();
      returnType = this.parseIdentifierName();
    }

    this.expect("fatArrow");
    const rhsExpression = this.parseExpression();

    return {
      functionName,
      params,
      returnType,
      rhsExpression,
    };
  }

  private parseStandaloneFunctionStatement(): ASTNode {
    const definition = this.parseFunctionDefinitionBinding();
    this.expect("semicolon");

    return {
      nodeType: "functionDefinition",
      ...definition,
      continueWith: this.emptySequence(),
    };
  }

  private parseFunctionStatement(): ASTNode {
    const definition = this.parseFunctionDefinitionBinding();
    this.expect("semicolon");
    const continueWith = this.parseStatementSequence();

    return {
      nodeType: "functionDefinition",
      ...definition,
      continueWith,
    };
  }

  private parseFunctionCall(functionName: string): ASTNode {
    this.expect("lparen");

    const args: ASTNode[] = [];
    if (this.currentToken().type !== "rparen") {
      while (true) {
        args.push(this.parseExpression());
        if (this.currentToken().type !== "comma") {
          break;
        }
        this.advance();
      }
    }

    this.expect("rparen");
    return {
      nodeType: "functionCall",
      functionName,
      args,
    };
  }

  private parseLetBinding(): Omit<
    Extract<ASTNode, { nodeType: "let" }>,
    "body" | "nodeType"
  > {
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
    const init = this.parseExpression();

    return {
      varName,
      init,
      isMutable,
      explicitType,
    };
  }

  private parseLetStatement(): ASTNode {
    const declaration = this.parseLetBinding();

    // Parse semicolon
    this.expect("semicolon");

    // Parse the body (rest of the statements)
    const body = this.parseStatementSequence();

    return {
      nodeType: "let",
      ...declaration,
      body,
    };
  }

  private parseAssignmentBinding(): Omit<
    Extract<ASTNode, { nodeType: "assignment" }>,
    "body" | "nodeType"
  > {
    // Parse variable name
    const nameToken = this.expect("identifier");
    const varName = (nameToken as Token & { type: "identifier" }).name;

    let value: ASTNode;
    if (this.currentToken().type === "plusEquals") {
      this.advance();
      const increment = this.parseExpression();
      value = {
        nodeType: "binary",
        operator: "+",
        left: { nodeType: "identifier", name: varName },
        right: increment,
      };
    } else if (this.currentToken().type === "minusEquals") {
      this.advance();
      const decrement = this.parseExpression();
      value = {
        nodeType: "binary",
        operator: "-",
        left: { nodeType: "identifier", name: varName },
        right: decrement,
      };
    } else if (this.currentToken().type === "timesEquals") {
      this.advance();
      const factor = this.parseExpression();
      value = {
        nodeType: "binary",
        operator: "*",
        left: { nodeType: "identifier", name: varName },
        right: factor,
      };
    } else if (this.currentToken().type === "divideEquals") {
      this.advance();
      const divisor = this.parseExpression();
      value = {
        nodeType: "binary",
        operator: "/",
        left: { nodeType: "identifier", name: varName },
        right: divisor,
      };
    } else {
      this.expect("equals");
      value = this.parseExpression();
    }

    return {
      varName,
      value,
    };
  }

  private parseAssignmentStatement(): ASTNode {
    const assignment = this.parseAssignmentBinding();

    // Parse semicolon
    this.expect("semicolon");

    // Parse the body (rest of the statements)
    const body = this.parseStatementSequence();

    return {
      nodeType: "assignment",
      ...assignment,
      body,
    };
  }

  private parseLogicalOr(): ASTNode {
    return this.parseBinary(
      () => this.parseLogicalAnd(),
      "logicalOperator",
      (op: string) => op === "||",
    );
  }

  private parseLogicalAnd(): ASTNode {
    return this.parseBinary(
      () => this.parseComparison(),
      "logicalOperator",
      (op: string) => op === "&&",
    );
  }

  private parseComparison(): ASTNode {
    return this.parseBinary(
      () => this.parseAdditive(),
      "comparisonOperator",
      () => true,
    );
  }

  private parseAdditive(): ASTNode {
    return this.parseBinary(
      () => this.parseMultiplicative(),
      "operator",
      (op: string) => op === "+" || op === "-",
    );
  }

  private parseMultiplicative(): ASTNode {
    return this.parseBinary(
      () => this.parseUnary(),
      "operator",
      (op: string) => op === "*" || op === "/",
    );
  }

  private parseUnary(): ASTNode {
    if (this.currentToken().type === "bang") {
      this.advance();
      return {
        nodeType: "unary",
        operator: "!",
        operand: this.parseUnary(),
      };
    }

    return this.parsePrimary();
  }

  private parseBinary(
    parseNext: () => ASTNode,
    tokenType: "operator" | "logicalOperator" | "comparisonOperator",
    isOperator: (op: string) => boolean,
  ): ASTNode {
    let left = parseNext();

    while (this.currentToken().type === tokenType) {
      const token = this.currentToken() as
        | (Token & { type: "operator" })
        | (Token & { type: "logicalOperator" })
        | (Token & { type: "comparisonOperator" });
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

    if (token.type === "boolean") {
      const boolToken = token as Token & { type: "boolean" };
      this.advance();
      return {
        nodeType: "boolean",
        value: boolToken.value,
      };
    }

    if (token.type === "identifier") {
      const idToken = token as Token & { type: "identifier" };
      this.advance();

      if (this.currentToken().type === "lparen") {
        return this.parseFunctionCall(idToken.name);
      }

      return {
        nodeType: "identifier",
        name: idToken.name,
      };
    }

    if (token.type === "lparen") {
      this.advance();
      const node = this.parseExpression();
      this.expect("rparen");
      return node;
    }

    if (token.type === "lbrace") {
      return this.parseBlock(true);
    }

    if (token.type === "if") {
      return this.parseIfExpression();
    }

    throw new Error("Unexpected token: " + token.type);
  }
}

type Environment = Map<
  string,
  { value: number; typeStr: string; isMutable: boolean }
>;

type FunctionValue = {
  functionName: string;
  params: Array<{ name: string; typeStr: string }>;
  returnType?: string;
  rhsExpression: ASTNode;
  closureEnv: Environment;
  closureFunctions: FunctionEnvironment;
};

type FunctionEnvironment = Map<string, FunctionValue[]>;

type EvaluationContext = {
  functions: FunctionEnvironment;
  inFunction: boolean;
};

function validateValueInRange(
  value: number,
  typeStr: string,
  context?: string,
): void {
  const typeRange = TYPE_RANGES[typeStr];
  if (!typeRange) {
    throw new Error("Unknown type: " + typeStr);
  }
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

function isBooleanType(typeStr: string): boolean {
  return typeStr === "Bool";
}

function ensureBooleanValue(
  value: { value: number; typeStr: string },
  context: string,
): void {
  if (!isBooleanType(value.typeStr)) {
    throw new Error("Expected Bool for " + context + ", got " + value.typeStr);
  }
}

function isEqualityOperator(operator: string): boolean {
  return operator === "==" || operator === "!=";
}

function isComparisonOperator(operator: string): boolean {
  return (
    operator === "==" ||
    operator === "!=" ||
    operator === "<" ||
    operator === "<=" ||
    operator === ">" ||
    operator === ">="
  );
}

function ensureAssignableToType(
  value: { value: number; typeStr: string },
  targetType: string,
): void {
  if (isBooleanType(targetType)) {
    if (!isBooleanType(value.typeStr)) {
      throw new Error(
        "Cannot assign value of type " + value.typeStr + " to type Bool",
      );
    }
    validateValueInRange(value.value, targetType);
    return;
  }

  if (isBooleanType(value.typeStr)) {
    throw new Error("Cannot assign value of type Bool to type " + targetType);
  }

  validateValueInRange(value.value, targetType);
}

function getCompatibleBranchType(leftType: string, rightType: string): string {
  const leftIsBool = isBooleanType(leftType);
  const rightIsBool = isBooleanType(rightType);

  if (leftIsBool || rightIsBool) {
    if (leftType !== rightType) {
      throw new Error(
        "If expression branches must have compatible types: " +
          leftType +
          " and " +
          rightType,
      );
    }

    return leftType;
  }

  return getWidestType(leftType, rightType);
}

function ensureMutableBinding(
  binding: { value: number; typeStr: string; isMutable: boolean },
  varName: string,
): void {
  if (!binding.isMutable) {
    throw new Error("Cannot assign to immutable variable: " + varName);
  }
}

function requireProducedType(
  typeStr: string | undefined,
  message: string,
): string {
  if (!typeStr) {
    throw new Error(message);
  }

  return typeStr;
}

function validateComparisonOperandTypes(
  leftType: string,
  rightType: string,
  operator: string,
): void {
  const leftIsBool = isBooleanType(leftType);
  const rightIsBool = isBooleanType(rightType);

  if (leftIsBool || rightIsBool) {
    if (leftIsBool !== rightIsBool) {
      throw new Error("Cannot compare Bool with numeric type");
    }

    if (!isEqualityOperator(operator)) {
      throw new Error("Ordering comparison is not supported for Bool values");
    }
  }
}

function validateArithmeticOperandTypes(
  leftType: string,
  rightType: string,
  operator: string,
): void {
  if (isBooleanType(leftType) || isBooleanType(rightType)) {
    throw new Error(
      "Boolean values cannot be used with arithmetic operator " + operator,
    );
  }
}

function canAssignType(fromType: string, targetType: string): boolean {
  if (targetType === "Bool" || fromType === "Bool") {
    return fromType === targetType;
  }

  const fromRange = TYPE_RANGES[fromType];
  const targetRange = TYPE_RANGES[targetType];

  if (!fromRange || !targetRange) {
    return false;
  }

  return fromRange.min >= targetRange.min && fromRange.max <= targetRange.max;
}

function createFunctionSignature(
  functionName: string,
  paramTypes: string[],
): string {
  return functionName + "(" + paramTypes.join(",") + ")";
}

function registerFunction(
  definition: Extract<ASTNode, { nodeType: "functionDefinition" }>,
  env: Environment,
  functions: FunctionEnvironment,
): void {
  const overloads = functions.get(definition.functionName) ?? [];
  const paramTypes = definition.params.map((param) => param.typeStr);
  const duplicate = overloads.some(
    (existing) =>
      createFunctionSignature(
        existing.functionName,
        existing.params.map((param) => param.typeStr),
      ) === createFunctionSignature(definition.functionName, paramTypes),
  );

  if (duplicate) {
    throw new Error(
      "Duplicate function signature: " +
        createFunctionSignature(definition.functionName, paramTypes),
    );
  }

  overloads.push({
    functionName: definition.functionName,
    params: definition.params,
    returnType: definition.returnType,
    rhsExpression: definition.rhsExpression,
    closureEnv: new Map(env),
    closureFunctions: functions,
  });

  functions.set(definition.functionName, overloads);
}

function requireUnambiguousMatch(
  matches: FunctionValue[],
  functionName: string,
): FunctionValue | null {
  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error("Ambiguous function call: " + functionName);
  }

  return null;
}

function resolveFunction(
  functionName: string,
  argTypes: string[],
  functions: FunctionEnvironment,
): FunctionValue {
  const overloads = functions.get(functionName) ?? [];

  const exactMatches = overloads.filter(
    (fn) =>
      fn.params.length === argTypes.length &&
      fn.params.every((param, index) => param.typeStr === argTypes[index]),
  );

  const exactMatch = requireUnambiguousMatch(exactMatches, functionName);
  if (exactMatch) {
    return exactMatch;
  }

  const assignableMatches = overloads.filter(
    (fn) =>
      fn.params.length === argTypes.length &&
      fn.params.every((param, index) =>
        canAssignType(argTypes[index]!, param.typeStr),
      ),
  );

  const assignableMatch = requireUnambiguousMatch(
    assignableMatches,
    functionName,
  );
  if (assignableMatch) {
    return assignableMatch;
  }

  throw new Error(
    "No matching overload for function " +
      functionName +
      " with arguments (" +
      argTypes.join(",") +
      ")",
  );
}

function inferType(
  node: ASTNode,
  env: Environment,
  functions: FunctionEnvironment,
): string | undefined {
  switch (node.nodeType) {
    case "number":
      return node.typeStr;

    case "boolean":
      return "Bool";

    case "identifier":
      return getOrThrowBinding(node.name, env).typeStr;

    case "unary": {
      const operandType = inferType(node.operand, env, functions);
      if (!operandType || !isBooleanType(operandType)) {
        throw new Error("Expected Bool for " + node.operator);
      }
      return "Bool";
    }

    case "binary": {
      const leftType = inferType(node.left, env, functions);
      const rightType = inferType(node.right, env, functions);

      if (!leftType || !rightType) {
        throw new Error("Binary expression requires value-producing operands");
      }

      if (node.operator === "&&" || node.operator === "||") {
        if (!isBooleanType(leftType) || !isBooleanType(rightType)) {
          throw new Error("Expected Bool for " + node.operator);
        }
        return "Bool";
      }

      if (isComparisonOperator(node.operator)) {
        validateComparisonOperandTypes(leftType, rightType, node.operator);

        return "Bool";
      }

      validateArithmeticOperandTypes(leftType, rightType, node.operator);

      return getWidestType(leftType, rightType);
    }

    case "let": {
      const initType = inferType(node.init, env, functions);
      if (!initType) {
        throw new Error("Let initializer must produce a value");
      }

      const varType = node.explicitType || initType;

      if (node.explicitType) {
        ensureAssignableToType(
          { value: 0, typeStr: initType },
          node.explicitType,
        );
      }

      const newEnv = new Map(env);
      newEnv.set(node.varName, {
        value: 0,
        typeStr: varType,
        isMutable: node.isMutable,
      });

      return inferType(node.body, newEnv, functions);
    }

    case "assignment": {
      const binding = getMutableBindingOrThrow(node.varName, env);
      const valueType = requireProducedType(
        inferType(node.value, env, functions),
        "Assignment value must produce a value",
      );
      ensureAssignableToType({ value: 0, typeStr: valueType }, binding.typeStr);
      return inferType(node.body, env, functions);
    }

    case "ifExpression": {
      const conditionType = inferType(node.condition, env, functions);
      if (!conditionType || !isBooleanType(conditionType)) {
        throw new Error("If condition must be Bool");
      }

      const thenType = inferType(node.thenBranch, new Map(env), functions);
      const elseType = inferType(node.elseBranch, new Map(env), functions);

      if (!thenType || !elseType) {
        throw new Error("If expression branches must produce values");
      }

      return getCompatibleBranchType(thenType, elseType);
    }

    case "ifStatement":
      return inferType(node.body, env, functions);

    case "functionDefinition": {
      registerFunction(node, env, functions);
      return inferType(node.continueWith, env, functions);
    }

    case "functionCall": {
      const argTypes = node.args.map((arg) =>
        requireProducedType(
          inferType(arg, env, functions),
          "Function call argument must produce a value",
        ),
      );

      const fn = resolveFunction(node.functionName, argTypes, functions);
      return fn.returnType;
    }

    case "returnStatement": {
      return undefined;
    }

    case "whileStatement":
      return inferType(node.continueWith, env, functions);

    case "break":
    case "continue":
      return undefined;

    case "block":
      return node.body
        ? inferType(node.body, new Map(env), functions)
        : undefined;

    case "sequence":
      return node.statements.length === 0
        ? undefined
        : inferType(
            node.statements[node.statements.length - 1]!,
            env,
            functions,
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

function getMutableBindingOrThrow(
  varName: string,
  env: Environment,
): { value: number; typeStr: string; isMutable: boolean } {
  const binding = getOrThrowBinding(varName, env);
  ensureMutableBinding(binding, varName);
  return binding;
}

function assignBindingValue(
  binding: { value: number; typeStr: string; isMutable: boolean },
  newValue: { value: number; typeStr: string },
): void {
  ensureAssignableToType(newValue, binding.typeStr);
  binding.value = newValue.value;
}

// Helper to propagate mutable binding changes from source env to target env
function propagateMutableChanges(
  sourceEnv: Environment,
  targetEnv: Environment,
): void {
  for (const [key, value] of sourceEnv) {
    const existingBinding = targetEnv.get(key);
    if (existingBinding && existingBinding.isMutable) {
      targetEnv.set(key, value);
    }
  }
}

function evaluate(
  node: ASTNode,
  env: Environment,
  context: EvaluationContext,
): { value: number; typeStr: string } {
  switch (node.nodeType) {
    case "number":
      return { value: node.value, typeStr: node.typeStr };

    case "boolean":
      return { value: node.value ? 1 : 0, typeStr: "Bool" };

    case "identifier": {
      return getOrThrowBinding(node.name, env);
    }

    case "functionCall": {
      const argValues = node.args.map((arg) => evaluate(arg, env, context));
      const fn = resolveFunction(
        node.functionName,
        argValues.map((arg) => arg.typeStr),
        context.functions,
      );

      const callEnv = new Map(fn.closureEnv);
      for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i]!;
        const arg = argValues[i]!;
        ensureAssignableToType(arg, param.typeStr);
        callEnv.set(param.name, {
          value: arg.value,
          typeStr: param.typeStr,
          isMutable: false,
        });
      }

      const callContext: EvaluationContext = {
        functions: new Map(fn.closureFunctions),
        inFunction: true,
      };

      try {
        const result = evaluate(fn.rhsExpression, callEnv, callContext);

        if (fn.returnType) {
          ensureAssignableToType(result, fn.returnType);
          return { value: result.value, typeStr: fn.returnType };
        }

        return result;
      } catch (error) {
        if (error instanceof ReturnException) {
          if (fn.returnType) {
            ensureAssignableToType(error.payload, fn.returnType);
            return { value: error.payload.value, typeStr: fn.returnType };
          }

          return error.payload;
        }

        throw error;
      }
    }

    case "unary": {
      const operand = evaluate(node.operand, env, context);
      ensureBooleanValue(operand, node.operator);
      return { value: operand.value === 0 ? 1 : 0, typeStr: "Bool" };
    }

    case "binary": {
      if (node.operator === "&&" || node.operator === "||") {
        const left = evaluate(node.left, env, context);
        ensureBooleanValue(left, node.operator);

        if (node.operator === "&&" && left.value === 0) {
          return { value: 0, typeStr: "Bool" };
        }

        if (node.operator === "||" && left.value !== 0) {
          return { value: 1, typeStr: "Bool" };
        }

        const right = evaluate(node.right, env, context);
        ensureBooleanValue(right, node.operator);
        return {
          value: Number(right.value !== 0),
          typeStr: "Bool",
        };
      }

      const left = evaluate(node.left, env, context);
      const right = evaluate(node.right, env, context);

      if (isComparisonOperator(node.operator)) {
        validateComparisonOperandTypes(
          left.typeStr,
          right.typeStr,
          node.operator,
        );

        if (isBooleanType(left.typeStr)) {
          return {
            value:
              node.operator === "=="
                ? Number(left.value === right.value)
                : Number(left.value !== right.value),
            typeStr: "Bool",
          };
        }

        let result: boolean;
        switch (node.operator) {
          case "==":
            result = left.value === right.value;
            break;
          case "!=":
            result = left.value !== right.value;
            break;
          case "<":
            result = left.value < right.value;
            break;
          case "<=":
            result = left.value <= right.value;
            break;
          case ">":
            result = left.value > right.value;
            break;
          case ">=":
            result = left.value >= right.value;
            break;
          default:
            result = false;
        }

        return { value: Number(result), typeStr: "Bool" };
      }

      const arithmeticOperator = node.operator;
      validateArithmeticOperandTypes(
        left.typeStr,
        right.typeStr,
        arithmeticOperator,
      );

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
          throw new Error("Unsupported arithmetic operator: " + node.operator);
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
      const initValue = evaluate(node.init, env, context);

      // Determine the actual type (explicit type annotation or inferred)
      const varType = node.explicitType || initValue.typeStr;

      // If explicit type is given, validate that the init value fits
      if (node.explicitType) {
        ensureAssignableToType(initValue, node.explicitType);
      }

      // Create a new environment with the bound variable
      const newEnv = new Map(env);
      newEnv.set(node.varName, {
        value: initValue.value,
        typeStr: varType,
        isMutable: node.isMutable,
      });

      // Evaluate the body in the new environment
      return evaluate(node.body, newEnv, context);
    }

    case "assignment": {
      const binding = getMutableBindingOrThrow(node.varName, env);
      const newValue = evaluate(node.value, env, context);
      assignBindingValue(binding, newValue);
      return evaluate(node.body, env, context);
    }

    case "ifExpression": {
      const condition = evaluate(node.condition, env, context);
      ensureBooleanValue(condition, "if condition");

      const resultType = inferType(node, env, context.functions);
      if (!resultType) {
        throw new Error("If expression must produce a value");
      }

      const branchValue =
        condition.value !== 0
          ? evaluate(node.thenBranch, new Map(env), context)
          : evaluate(node.elseBranch, new Map(env), context);

      ensureAssignableToType(branchValue, resultType);
      return { value: branchValue.value, typeStr: resultType };
    }

    case "ifStatement": {
      const condition = evaluate(node.condition, env, context);
      ensureBooleanValue(condition, "if condition");

      if (condition.value !== 0) {
        evaluate(node.thenBranch, new Map(env), context);
      } else if (node.elseBranch) {
        evaluate(node.elseBranch, new Map(env), context);
      }

      return evaluate(node.body, env, context);
    }

    case "functionDefinition": {
      registerFunction(node, env, context.functions);
      return evaluate(node.continueWith, env, context);
    }

    case "returnStatement": {
      if (!context.inFunction) {
        throw new Error("return statement is only valid inside a function");
      }

      const value = evaluate(node.value, env, context);
      throw new ReturnException(value);
    }

    case "block": {
      if (!node.body) {
        return { value: 0, typeStr: "U8" };
      }

      return evaluate(node.body, new Map(env), context);
    }

    case "sequence": {
      for (const stmt of node.statements) {
        if (stmt.nodeType === "functionDefinition") {
          registerFunction(stmt, env, context.functions);
        }
      }

      let result: { value: number; typeStr: string } = {
        value: 0,
        typeStr: "U8",
      };
      for (const stmt of node.statements) {
        if (stmt.nodeType === "functionDefinition") {
          result = evaluate(stmt.continueWith, env, context);
          continue;
        }

        result = evaluate(stmt, env, context);
      }
      return result;
    }

    case "whileStatement": {
      const loopEnv = new Map(env);
      while (true) {
        const condition = evaluate(node.condition, loopEnv, context);
        ensureBooleanValue(condition, "while condition");

        if (condition.value === 0) {
          break;
        }

        // Fresh scope per iteration, but mutable bindings persist
        const iterationEnv = new Map(loopEnv);
        try {
          evaluate(node.body, iterationEnv, context);
        } catch (e) {
          if (e instanceof BreakException) {
            break;
          }
          if (e instanceof ContinueException) {
            // Propagate outer mut changes back to loopEnv
            propagateMutableChanges(iterationEnv, loopEnv);
            continue;
          }
          throw e;
        }

        // Propagate outer mut changes back to loopEnv
        propagateMutableChanges(iterationEnv, loopEnv);
      }

      // Propagate outer mut changes back to original env
      propagateMutableChanges(loopEnv, env);

      return evaluate(node.continueWith, env, context);
    }

    case "break": {
      throw new BreakException();
    }

    case "continue": {
      throw new ContinueException();
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
  const result = evaluate(ast, new Map(), {
    functions: new Map(),
    inFunction: false,
  });

  return result.value;
}
