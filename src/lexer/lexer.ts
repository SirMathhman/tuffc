import { createDiagnostic, type Diagnostic } from "../diagnostics";
import { keywordKinds, TokenKind, type LexResult, type Token } from "./tokens";

const escapeMap: Readonly<Record<string, string>> = {
  n: "\n",
  r: "\r",
  t: "\t",
  ["\\"]: "\\",
  ['"']: '"',
  ["'"]: "'",
};

export function lex(source: string): LexResult {
  return new Lexer(source).scanTokens();
}

class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private tokenColumn = 1;

  public constructor(source: string) {
    this.source = source;
  }

  public scanTokens(): LexResult {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.tokenColumn = this.column;
      this.scanToken();
    }

    this.tokens.push({ kind: TokenKind.Eof, lexeme: "", line: this.line, column: this.column });
    return { tokens: this.tokens, diagnostics: this.diagnostics };
  }

  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      case "(":
        this.addToken(TokenKind.LeftParen);
        return;
      case ")":
        this.addToken(TokenKind.RightParen);
        return;
      case "{":
        this.addToken(TokenKind.LeftBrace);
        return;
      case "}":
        this.addToken(TokenKind.RightBrace);
        return;
      case ",":
        this.addToken(TokenKind.Comma);
        return;
      case ":":
        this.addToken(TokenKind.Colon);
        return;
      case ";":
        this.addToken(TokenKind.Semicolon);
        return;
      case "+":
        this.addCompoundToken("=", TokenKind.PlusEqual, TokenKind.Plus);
        return;
      case "-":
        this.addCompoundToken("=", TokenKind.MinusEqual, TokenKind.Minus);
        return;
      case "*":
        this.addCompoundToken("=", TokenKind.StarEqual, TokenKind.Star);
        return;
      case "%":
        this.addCompoundToken("=", TokenKind.PercentEqual, TokenKind.Percent);
        return;
      case "!":
        this.addCompoundToken("=", TokenKind.BangEqual, TokenKind.Bang);
        return;
      case "=":
        if (this.match("=")) {
          this.addToken(TokenKind.EqualEqual);
          return;
        }

        if (this.match(">")) {
          this.addToken(TokenKind.FatArrow);
          return;
        }

        this.addToken(TokenKind.Equal);
        return;
      case "<":
        this.addCompoundToken("=", TokenKind.LessEqual, TokenKind.Less);
        return;
      case ">":
        this.addCompoundToken("=", TokenKind.GreaterEqual, TokenKind.Greater);
        return;
      case "&":
        if (this.match("&")) {
          this.addToken(TokenKind.AndAnd);
          return;
        }

        this.reportUnexpected("&");
        return;
      case "|":
        if (this.match("|")) {
          this.addToken(TokenKind.OrOr);
          return;
        }

        this.reportUnexpected("|");
        return;
      case "/":
        if (this.match("/")) {
          this.skipLineComment();
          return;
        }

        if (this.match("*")) {
          this.skipBlockComment();
          return;
        }

        this.addCompoundToken("=", TokenKind.SlashEqual, TokenKind.Slash);
        return;
      case " ":
      case "\r":
      case "\t":
      case "\n":
        return;
      case '"':
        this.scanString();
        return;
      case "'":
        this.scanChar();
        return;
      default:
        if (this.isDigit(char)) {
          this.scanNumber();
          return;
        }

        if (this.isIdentifierStart(char)) {
          this.scanIdentifier();
          return;
        }

        this.reportUnexpected(char);
    }
  }

  private scanIdentifier(): void {
    while (!this.isAtEnd() && this.isIdentifierPart(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(this.start, this.current);
    const kind = keywordKinds[lexeme] ?? TokenKind.Identifier;

    if (kind === TokenKind.True) {
      this.addToken(kind, true);
      return;
    }

    if (kind === TokenKind.False) {
      this.addToken(kind, false);
      return;
    }

    this.addToken(kind);
  }

  private scanNumber(): void {
    this.consumeDigits();

    let kind = TokenKind.Integer;

    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      kind = TokenKind.Float;
      this.advance();

      this.consumeDigits();
    }

    const lexeme = this.source.slice(this.start, this.current);
    const normalized = lexeme.replaceAll("_", "");
    const literal = kind === TokenKind.Integer ? Number.parseInt(normalized, 10) : Number.parseFloat(normalized);
    this.addToken(kind, literal, lexeme);
  }

  private scanString(): void {
    let value = "";

    while (!this.isAtEnd() && this.peek() !== '"') {
      const char = this.advance();

      if (char === "\\") {
        if (this.isAtEnd()) {
          break;
        }

        const escaped = this.advance();
        value += escapeMap[escaped] ?? escaped;
        continue;
      }

      if (char === "\n") {
        this.line += 1;
        this.column = 1;
      }

      value += char;
    }

    if (this.isAtEnd()) {
      this.diagnostics.push(createDiagnostic("Unterminated string literal.", this.line, this.tokenColumn));
      return;
    }

    this.advance();
    this.addToken(TokenKind.String, value);
  }

  private scanChar(): void {
    let value = "";

    if (this.isAtEnd()) {
      this.diagnostics.push(createDiagnostic("Unterminated char literal.", this.line, this.tokenColumn));
      return;
    }

    if (this.peek() === "\\") {
      this.advance();

      if (this.isAtEnd()) {
        this.diagnostics.push(createDiagnostic("Unterminated char literal.", this.line, this.tokenColumn));
        return;
      }

      const escaped = this.advance();
      value = escapeMap[escaped] ?? escaped;
    } else {
      value = this.advance();
    }

    if (this.isAtEnd() || this.peek() !== "'") {
      this.diagnostics.push(createDiagnostic("Unterminated char literal.", this.line, this.tokenColumn));
      return;
    }

    this.advance();
    this.addToken(TokenKind.Char, value);
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance();
        this.advance();
        return;
      }

      const char = this.advance();
      if (char === "\n") {
        this.line += 1;
        this.column = 1;
      }
    }

    this.diagnostics.push(createDiagnostic("Unterminated block comment.", this.line, this.tokenColumn));
  }

  private addCompoundToken(expected: string, compoundKind: TokenKind, singleKind: TokenKind): void {
    if (this.match(expected)) {
      this.addToken(compoundKind);
      return;
    }

    this.addToken(singleKind);
  }

  private addToken(kind: TokenKind, literal?: string | number | boolean, lexemeOverride?: string): void {
    this.tokens.push({
      kind,
      lexeme: lexemeOverride ?? this.source.slice(this.start, this.current),
      literal,
      line: this.line,
      column: this.tokenColumn,
    });
  }

  private reportUnexpected(char: string): void {
    this.diagnostics.push(createDiagnostic(`Unexpected character '${char}'.`, this.line, this.tokenColumn));
  }

  private consumeDigits(): void {
    while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === "_")) {
      this.advance();
    }
  }

  private advance(): string {
    const char = this.source[this.current];
    this.current += 1;
    this.column += 1;
    return char;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.current] !== expected) {
      return false;
    }

    this.current += 1;
    this.column += 1;
    return true;
  }

  private peek(): string {
    return this.source[this.current] ?? "\0";
  }

  private peekNext(): string {
    return this.source[this.current + 1] ?? "\0";
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isIdentifierStart(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
  }

  private isIdentifierPart(char: string): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }
}