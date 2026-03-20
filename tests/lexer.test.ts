import { expect, test } from "bun:test";
import { lex, TokenKind } from "../src/lexer";

test("lexes a simple function", () => {
  const result = lex("fn main() => 1 + 2;");

  expect(result.diagnostics).toEqual([]);
  expect(result.tokens.map((token) => token.kind)).toEqual([
    TokenKind.Fn,
    TokenKind.Identifier,
    TokenKind.LeftParen,
    TokenKind.RightParen,
    TokenKind.FatArrow,
    TokenKind.Integer,
    TokenKind.Plus,
    TokenKind.Integer,
    TokenKind.Semicolon,
    TokenKind.Eof,
  ]);
});

test("lexes comments and literals", () => {
  const result = lex(`// hello\nlet value = "world"; /* done */`);

  expect(result.diagnostics).toEqual([]);
  expect(result.tokens.map((token) => token.kind)).toEqual([
    TokenKind.Let,
    TokenKind.Identifier,
    TokenKind.Equal,
    TokenKind.String,
    TokenKind.Semicolon,
    TokenKind.Eof,
  ]);
});