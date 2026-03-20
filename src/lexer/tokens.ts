export enum TokenKind {
  LeftParen = "LeftParen",
  RightParen = "RightParen",
  LeftBrace = "LeftBrace",
  RightBrace = "RightBrace",
  Comma = "Comma",
  Colon = "Colon",
  Semicolon = "Semicolon",
  Plus = "Plus",
  Minus = "Minus",
  Star = "Star",
  Slash = "Slash",
  Percent = "Percent",
  Bang = "Bang",
  Equal = "Equal",
  EqualEqual = "EqualEqual",
  BangEqual = "BangEqual",
  Less = "Less",
  LessEqual = "LessEqual",
  Greater = "Greater",
  GreaterEqual = "GreaterEqual",
  AndAnd = "AndAnd",
  OrOr = "OrOr",
  PlusEqual = "PlusEqual",
  MinusEqual = "MinusEqual",
  StarEqual = "StarEqual",
  SlashEqual = "SlashEqual",
  PercentEqual = "PercentEqual",
  FatArrow = "FatArrow",
  Identifier = "Identifier",
  Integer = "Integer",
  Float = "Float",
  String = "String",
  Char = "Char",
  Fn = "Fn",
  Let = "Let",
  Mut = "Mut",
  If = "If",
  Else = "Else",
  While = "While",
  Return = "Return",
  True = "True",
  False = "False",
  Eof = "Eof",
}

export interface Token {
  kind: TokenKind;
  lexeme: string;
  line: number;
  column: number;
  literal?: string | number | boolean;
}

export interface LexResult {
  tokens: Token[];
  diagnostics: import("../diagnostics").Diagnostic[];
}

export const keywordKinds: Readonly<Record<string, TokenKind>> = {
  fn: TokenKind.Fn,
  let: TokenKind.Let,
  mut: TokenKind.Mut,
  if: TokenKind.If,
  else: TokenKind.Else,
  while: TokenKind.While,
  return: TokenKind.Return,
  true: TokenKind.True,
  false: TokenKind.False,
};