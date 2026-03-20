import { createDiagnostic, type Diagnostic } from "../diagnostics";
import { lex } from "../lexer/lexer";
import { TokenKind, type Token } from "../lexer/tokens";
import { createTypeAnnotation } from "./ast";
import type {
  AssignmentExpression,
  BinaryExpression,
  BlockExpression,
  BoolLiteralExpression,
  CallExpression,
  CharLiteralExpression,
  ExprStatement,
  Expression,
  FloatLiteralExpression,
  FunctionDeclaration,
  IdentifierExpression,
  IfExpression,
  IntegerLiteralExpression,
  LetStatement,
  Parameter,
  Program,
  ReturnStatement,
  Statement,
  StringLiteralExpression,
  TypeAnnotation,
  UnaryExpression,
  WhileExpression,
} from "./ast";

export interface ParseResult {
  program?: Program;
  diagnostics: Diagnostic[];
}

export function parseSource(source: string): ParseResult {
  const lexResult = lex(source);
  if (lexResult.diagnostics.length > 0) {
    return { diagnostics: lexResult.diagnostics };
  }

  return parseTokens(lexResult.tokens);
}

export function parseTokens(tokens: Token[]): ParseResult {
  return new Parser(tokens).parseProgram();
}

class Parser {
  private readonly tokens: Token[];
  private readonly diagnostics: Diagnostic[] = [];
  private current = 0;

  public constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parseProgram(): ParseResult {
    const functions: FunctionDeclaration[] = [];

    while (!this.isAtEnd()) {
      const declaration = this.parseFunctionDeclaration();
      if (declaration !== undefined) {
        functions.push(declaration);
        continue;
      }

      this.synchronize();
    }

    if (this.diagnostics.length > 0) {
      return { diagnostics: this.diagnostics };
    }

    return { program: { kind: "Program", functions, line: 1, column: 1 }, diagnostics: [] };
  }

  private parseFunctionDeclaration(): FunctionDeclaration | undefined {
    if (!this.match(TokenKind.Fn)) {
      this.error(this.peek(), "Expected 'fn' declaration.");
      return undefined;
    }

    const fnToken = this.previous();
    const nameToken = this.consume(TokenKind.Identifier, "Expected function name.");
    this.consume(TokenKind.LeftParen, "Expected '('.");
    const parameters = this.parseParameters();
    this.consume(TokenKind.RightParen, "Expected ')'.");

    let returnType: TypeAnnotation | undefined;
    if (this.match(TokenKind.Colon)) {
      returnType = this.parseTypeAnnotation();
    }

    this.consume(TokenKind.FatArrow, "Expected '=>'.");
    const body = this.parseExpression();
    this.consume(TokenKind.Semicolon, "Expected ';' after function body.");

    return {
      kind: "FunctionDeclaration",
      name: nameToken?.lexeme ?? "<error>",
      parameters,
      returnType,
      body,
      line: fnToken.line,
      column: fnToken.column,
    };
  }

  private parseParameters(): Parameter[] {
    const parameters: Parameter[] = [];

    if (this.check(TokenKind.RightParen)) {
      return parameters;
    }

    do {
      const nameToken = this.consume(TokenKind.Identifier, "Expected parameter name.");
      this.consume(TokenKind.Colon, "Expected ':'.");
      const typeAnnotation = this.parseTypeAnnotation();

      parameters.push({
        kind: "Parameter",
        name: nameToken?.lexeme ?? "<error>",
        typeAnnotation,
        line: nameToken?.line ?? this.peek().line,
        column: nameToken?.column ?? this.peek().column,
      });
    } while (this.match(TokenKind.Comma));

    return parameters;
  }


  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expression = this.parseLogicalOr();

    if (!this.match(TokenKind.Equal, TokenKind.PlusEqual, TokenKind.MinusEqual, TokenKind.StarEqual, TokenKind.SlashEqual, TokenKind.PercentEqual)) {
      return expression;
    }

    const operatorToken = this.previous();
    const value = this.parseAssignment();

    if (expression.kind !== "IdentifierExpression") {
      this.error(operatorToken, "Assignment target must be an identifier.");
      return value;
    }

    return {
      kind: "AssignmentExpression",
      target: expression,
      operator: operatorToken.lexeme as AssignmentExpression["operator"],
      value,
      line: operatorToken.line,
      column: operatorToken.column,
    };
  }

  private parseLogicalOr(): Expression {
    return this.parseBinaryChain(this.parseLogicalAnd.bind(this), [TokenKind.OrOr], ["||"]);
  }

  private parseLogicalAnd(): Expression {
    return this.parseBinaryChain(this.parseEquality.bind(this), [TokenKind.AndAnd], ["&&"]);
  }

  private parseEquality(): Expression {
    return this.parseBinaryChain(this.parseComparison.bind(this), [TokenKind.EqualEqual, TokenKind.BangEqual], ["==", "!="]);
  }

  private parseComparison(): Expression {
    return this.parseBinaryChain(this.parseTerm.bind(this), [TokenKind.Less, TokenKind.LessEqual, TokenKind.Greater, TokenKind.GreaterEqual], ["<", "<=", ">", ">="]);
  }

  private parseTerm(): Expression {
    return this.parseBinaryChain(this.parseFactor.bind(this), [TokenKind.Plus, TokenKind.Minus], ["+", "-"]);
  }

  private parseFactor(): Expression {
    return this.parseBinaryChain(this.parseUnary.bind(this), [TokenKind.Star, TokenKind.Slash, TokenKind.Percent], ["*", "/", "%"]);
  }

  private parseBinaryChain(parseNext: () => Expression, kinds: TokenKind[], operators: Array<BinaryExpression["operator"]>): Expression {
    let expression = parseNext();

    while (true) {
      let matchedIndex = -1;

      for (let index = 0; index < kinds.length; index += 1) {
        if (this.match(kinds[index])) {
          matchedIndex = index;
          break;
        }
      }

      if (matchedIndex < 0) {
        break;
      }

      const operatorToken = this.previous();
      const right = parseNext();

      expression = {
        kind: "BinaryExpression",
        left: expression,
        operator: operators[matchedIndex],
        right,
        line: operatorToken.line,
        column: operatorToken.column,
      };
    }

    return expression;
  }

  private parseUnary(): Expression {
    if (this.match(TokenKind.Bang, TokenKind.Minus)) {
      const operatorToken = this.previous();
      const operand = this.parseUnary();

      return {
        kind: "UnaryExpression",
        operator: operatorToken.lexeme as UnaryExpression["operator"],
        operand,
        line: operatorToken.line,
        column: operatorToken.column,
      };
    }

    return this.parseCall();
  }

  private parseCall(): Expression {
    let expression = this.parsePrimary();

    while (this.match(TokenKind.LeftParen)) {
      const openParen = this.previous();
      const args: Expression[] = [];

      if (!this.check(TokenKind.RightParen)) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenKind.Comma));
      }

      this.consume(TokenKind.RightParen, "Expected ')'.");

      expression = {
        kind: "CallExpression",
        callee: expression,
        arguments: args,
        line: openParen.line,
        column: openParen.column,
      };
    }

    return expression;
  }

  private parsePrimary(): Expression {
    if (this.match(TokenKind.Integer)) {
      return this.makeNumericLiteral(this.previous(), true);
    }

    if (this.match(TokenKind.Float)) {
      return this.makeNumericLiteral(this.previous(), false);
    }

    if (this.match(TokenKind.String)) {
      return this.makeTextLiteral(this.previous(), "StringLiteralExpression");
    }

    if (this.match(TokenKind.Char)) {
      return this.makeTextLiteral(this.previous(), "CharLiteralExpression");
    }

    if (this.match(TokenKind.True, TokenKind.False)) {
      const token = this.previous();
      return { kind: "BoolLiteralExpression", value: token.kind === TokenKind.True, line: token.line, column: token.column };
    }

    if (this.match(TokenKind.Identifier)) {
      const token = this.previous();
      return { kind: "IdentifierExpression", name: token.lexeme, line: token.line, column: token.column };
    }

    if (this.match(TokenKind.LeftParen)) {
      const expression = this.parseExpression();
      this.consume(TokenKind.RightParen, "Expected ')'.");
      return expression;
    }

    if (this.match(TokenKind.LeftBrace)) {
      return this.parseBlockExpression(this.previous());
    }

    if (this.match(TokenKind.If)) {
      return this.parseIfExpression(this.previous());
    }

    if (this.match(TokenKind.While)) {
      return this.parseWhileExpression(this.previous());
    }

    const token = this.peek();
    this.error(token, "Expected expression.");
    return { kind: "IdentifierExpression", name: "<error>", line: token.line, column: token.column };
  }

  private parseBlockExpression(openBrace: Token): BlockExpression {
    const statements: Statement[] = [];
    let value: Expression | undefined;

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      if (this.match(TokenKind.Let)) {
        statements.push(this.parseLetStatement(this.previous()));
        this.consume(TokenKind.Semicolon, "Expected ';' after let statement.");
        continue;
      }

      if (this.match(TokenKind.Return)) {
        statements.push(this.parseReturnStatement(this.previous()));
        this.consume(TokenKind.Semicolon, "Expected ';' after return statement.");
        continue;
      }

      const expression = this.parseExpression();
      if (this.match(TokenKind.Semicolon)) {
        statements.push({ kind: "ExprStatement", expression, line: expression.line, column: expression.column });
        continue;
      }

      value = expression;
      break;
    }

    this.consume(TokenKind.RightBrace, "Expected '}' to close block.");
    return { kind: "BlockExpression", statements, value, line: openBrace.line, column: openBrace.column };
  }

  private parseIfExpression(ifToken: Token): IfExpression {
    this.consume(TokenKind.LeftParen, "Expected '('.");
    const condition = this.parseExpression();
    this.consume(TokenKind.RightParen, "Expected ')'.");
    const thenBranch = this.parseRequiredBlock();

    let elseBranch: Expression | undefined;
    if (this.match(TokenKind.Else)) {
      if (this.match(TokenKind.If)) {
        elseBranch = this.parseIfExpression(this.previous());
      } else if (this.check(TokenKind.LeftBrace)) {
        elseBranch = this.parseRequiredBlock();
      } else {
        elseBranch = this.parseExpression();
      }
    }

    return { kind: "IfExpression", condition, thenBranch, elseBranch, line: ifToken.line, column: ifToken.column };
  }

  private parseWhileExpression(whileToken: Token): WhileExpression {
    this.consume(TokenKind.LeftParen, "Expected '('.");
    const condition = this.parseExpression();
    this.consume(TokenKind.RightParen, "Expected ')'.");
    const body = this.parseRequiredBlock();
    return { kind: "WhileExpression", condition, body, line: whileToken.line, column: whileToken.column };
  }

  private parseRequiredBlock(): BlockExpression {
    const openBrace = this.consume(TokenKind.LeftBrace, "Expected '{'.");
    return this.parseBlockExpression(openBrace ?? this.peek());
  }

  private parseLetStatement(letToken: Token): LetStatement {
    const mutable = this.match(TokenKind.Mut);
    const nameToken = this.consume(TokenKind.Identifier, "Expected variable name.");
    let typeAnnotation: TypeAnnotation | undefined;

    if (this.match(TokenKind.Colon)) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenKind.Equal, "Expected '=' in let statement.");
    const initializer = this.parseExpression();

    return {
      kind: "LetStatement",
      mutable,
      name: nameToken?.lexeme ?? "<error>",
      typeAnnotation,
      initializer,
      line: letToken.line,
      column: letToken.column,
    };
  }

  private parseReturnStatement(returnToken: Token): ReturnStatement {
    const value = this.check(TokenKind.Semicolon) ? undefined : this.parseExpression();
    return { kind: "ReturnStatement", value, line: returnToken.line, column: returnToken.column };
  }

  private parseTypeAnnotation(): TypeAnnotation {
    const token = this.consume(TokenKind.Identifier, "Expected type name.");
    return createTypeAnnotation(token?.lexeme ?? "<error>", token?.line ?? this.peek().line, token?.column ?? this.peek().column);
  }

  private makeNumericLiteral(token: Token, integer: boolean): IntegerLiteralExpression | FloatLiteralExpression {
    const raw = String(token.literal ?? token.lexeme).replaceAll("_", "");
    return integer
      ? { kind: "IntegerLiteralExpression", value: Number.parseInt(raw, 10), line: token.line, column: token.column }
      : { kind: "FloatLiteralExpression", value: Number.parseFloat(raw), line: token.line, column: token.column };
  }

  private makeTextLiteral(token: Token, kind: "StringLiteralExpression" | "CharLiteralExpression"): StringLiteralExpression | CharLiteralExpression {
    return { kind, value: String(token.literal ?? token.lexeme), line: token.line, column: token.column };
  }

  private match(...kinds: TokenKind[]): boolean {
    for (const kind of kinds) {
      if (this.check(kind)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  private consume(kind: TokenKind, message: string): Token | undefined {
    if (this.check(kind)) {
      return this.advance();
    }

    this.error(this.peek(), message);
    return undefined;
  }

  private check(kind: TokenKind): boolean {
    return !this.isAtEnd() && this.peek().kind === kind;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }

    return this.previous();
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.tokens[0];
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.Eof;
  }

  private error(token: Token, message: string): void {
    this.diagnostics.push(createDiagnostic(message, token.line, token.column));
  }

  private synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.previous().kind === TokenKind.Semicolon) {
        return;
      }

      switch (this.peek().kind) {
        case TokenKind.Fn:
        case TokenKind.Let:
        case TokenKind.If:
        case TokenKind.While:
        case TokenKind.Return:
          return;
      }

      this.advance();
    }
  }
}