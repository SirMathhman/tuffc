import { TuffError } from "./errors.ts";
import { err, ok } from "./result.ts";

const KEYWORDS = new Set([
  "fn",
  "let",
  "struct",
  "enum",
  "type",
  "match",
  "case",
  "if",
  "else",
  "for",
  "while",
  "loop",
  "in",
  "return",
  "break",
  "continue",
  "is",
  "class",
  "object",
  "contract",
  "impl",
  "into",
  "with",
  "out",
  "module",
  "extern",
  "copy",
  "async",
  "mut",
  "uninit",
  "move",
  "then",
]);

const TWO_CHAR = new Set([
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "::",
  "..",
  "|>",
]);
const THREE_CHAR = new Set(["..."]);

function isAlpha(ch) {
  return /[A-Za-z_]/.test(ch);
}

function isNum(ch) {
  return /[0-9]/.test(ch);
}

function isAlphaNum(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}

export function lex(
  source: string,
  filePath: string = "<memory>",
): { ok: true; value: unknown[] } | { ok: false; error: unknown } {
  const tokens = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const loc = () => ({ filePath, line, column, index: i });

  const advance = () => {
    const ch = source[i++];
    if (ch === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return ch;
  };

  const peek = (n = 0) => source[i + n] ?? "\0";

  const add = (type, value, start, startIndex) =>
    tokens.push({ type, value, loc: start, start: startIndex, end: i });

  while (i < source.length) {
    const ch = peek();
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance();
      continue;
    }

    if (ch === "/" && peek(1) === "/") {
      while (i < source.length && peek() !== "\n") advance();
      continue;
    }

    if (ch === "/" && peek(1) === "*") {
      advance();
      advance();
      while (i < source.length && !(peek() === "*" && peek(1) === "/")) {
        advance();
      }
      if (i >= source.length)
        return err(
          new TuffError("Unterminated block comment", loc(), {
            code: "E_LEX_UNTERMINATED_BLOCK_COMMENT",
            hint: "Close the comment with */.",
          }),
        );
      advance();
      advance();
      continue;
    }

    const start = loc();
    const startIndex = i;
    const three = `${peek()}${peek(1)}${peek(2)}`;
    if (THREE_CHAR.has(three)) {
      advance();
      advance();
      advance();
      add("symbol", three, start, startIndex);
      continue;
    }

    const two = `${peek()}${peek(1)}`;
    if (TWO_CHAR.has(two)) {
      advance();
      advance();
      add("symbol", two, start, startIndex);
      continue;
    }

    if (isAlpha(ch)) {
      let text = "";
      while (isAlphaNum(peek())) text += advance();
      if (KEYWORDS.has(text)) {
        add("keyword", text, start, startIndex);
      } else if (text === "true" || text === "false") {
        add("bool", text === "true", start, startIndex);
      } else {
        add("identifier", text, start, startIndex);
      }
      continue;
    }

    if (isNum(ch)) {
      let text = "";
      if (peek() === "0" && ["x", "b", "o"].includes(peek(1))) {
        text += advance();
        text += advance();
        while (/[0-9A-Fa-f_]/.test(peek())) text += advance();
      } else {
        while (/[0-9_]/.test(peek())) text += advance();
        if (peek() === "." && isNum(peek(1))) {
          text += advance();
          while (/[0-9_]/.test(peek())) text += advance();
        }
      }
      let suffix = "";
      while (/[A-Za-z0-9_]/.test(peek())) suffix += advance();
      add(
        "number",
        `${text.replaceAll("_", "")}${suffix.replaceAll("_", "")}`,
        start,
        startIndex,
      );
      continue;
    }

    if (ch === '"') {
      advance();
      let text = "";
      while (i < source.length && peek() !== '"') {
        if (peek() === "\\") {
          const a = advance();
          const b = advance();
          text += a + b;
        } else {
          text += advance();
        }
      }
      if (peek() !== '"')
        return err(
          new TuffError("Unterminated string literal", start, {
            code: "E_LEX_UNTERMINATED_STRING",
            hint: "Close the string with a matching double quote.",
          }),
        );
      advance();
      add("string", text, start, startIndex);
      continue;
    }

    if (ch === "'") {
      advance();
      let text = "";
      while (i < source.length && peek() !== "'") {
        text += advance();
      }
      if (peek() !== "'")
        return err(
          new TuffError("Unterminated char literal", start, {
            code: "E_LEX_UNTERMINATED_CHAR",
            hint: "Close the char literal with a matching single quote.",
          }),
        );
      advance();
      add("char", text, start, startIndex);
      continue;
    }

    if ("(){}[],:;+-*/%<>=.!?|&".includes(ch)) {
      advance();
      add("symbol", ch, start, startIndex);
      continue;
    }

    return err(
      new TuffError(`Unexpected character '${ch}'`, start, {
        code: "E_LEX_UNEXPECTED_CHAR",
        hint: "Remove or escape the invalid character.",
      }),
    );
  }

  tokens.push({
    type: "eof",
    value: "<eof>",
    loc: { filePath, line, column, index: i },
    start: i,
    end: i,
  });
  return ok(tokens);
}
