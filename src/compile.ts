import { type Result, ok, err } from "./types";

const VALID_TYPES = new Set([
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
  "F32",
  "F64",
]);

// Token types
type Token =
  | { type: "NUMBER"; value: string }
  | { type: "OPERATOR"; value: "+" | "-" | "*" | "/" }
  | { type: "IDENTIFIER"; value: string }
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "LT" }
  | { type: "GT" }
  | { type: "EOF" };

// AST node types
type ASTNode =
  | { kind: "number"; value: string }
  | { kind: "read"; type: string }
  | {
      kind: "binary";
      left: ASTNode;
      operator: "+" | "-" | "*" | "/";
      right: ASTNode;
    };

function isWhitespace(char: string | undefined): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\v" ||
    char === "\f"
  );
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isLetter(char: string | undefined): boolean {
  return (
    (char !== undefined && char >= "a" && char <= "z") ||
    (char !== undefined && char >= "A" && char <= "Z")
  );
}

function validateType(typeStr: string): Result<undefined, string> {
  if (!VALID_TYPES.has(typeStr)) {
    return err(`Invalid type annotation: ${typeStr}`);
  }
  return ok(undefined);
}

function tokenize(input: string): Result<Token[], string> {
  const tokens: Token[] = [];
  let pos = 0;

  const lastToken = (): Token | undefined => {
    return tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
  };

  const isOperatorContext = (): boolean => {
    const last = lastToken();
    return (
      last !== undefined && (last.type === "NUMBER" || last.type === "RPAREN")
    );
  };

  while (pos < input.length) {
    const char = input[pos];

    // Skip whitespace
    if (isWhitespace(char)) {
      pos++;
      continue;
    }

    // Operators (only if following a number or closing paren)
    if (char === "+" && isOperatorContext()) {
      tokens.push({ type: "OPERATOR", value: "+" });
      pos++;
    } else if (char === "-" && isOperatorContext()) {
      tokens.push({ type: "OPERATOR", value: "-" });
      pos++;
    } else if (char === "*" && isOperatorContext()) {
      tokens.push({ type: "OPERATOR", value: "*" });
      pos++;
    } else if (char === "/" && isOperatorContext()) {
      tokens.push({ type: "OPERATOR", value: "/" });
      pos++;
    } else if (char === "(") {
      tokens.push({ type: "LPAREN" });
      pos++;
    } else if (char === ")") {
      tokens.push({ type: "RPAREN" });
      pos++;
    } else if (char === "<") {
      tokens.push({ type: "LT" });
      pos++;
    } else if (char === ">") {
      tokens.push({ type: "GT" });
      pos++;
    } else if (isLetter(char)) {
      // Parse identifier (e.g., 'read' or type like 'U8')
      let ident = "";
      while (
        pos < input.length &&
        (isLetter(input[pos]) || isDigit(input[pos]))
      ) {
        ident += input[pos];
        pos++;
      }
      tokens.push({ type: "IDENTIFIER", value: ident });
    } else if (isDigit(char) || (char === "-" && isDigit(input[pos + 1]))) {
      // Parse number with optional type and optional leading sign
      let numStr = "";

      // Handle optional negative sign
      if (char === "-") {
        numStr += "-";
        pos++;
      }

      // Parse digits
      while (pos < input.length && isDigit(input[pos])) {
        numStr += input[pos];
        pos++;
      }

      // Parse optional decimal point
      if (pos < input.length && input[pos] === ".") {
        numStr += ".";
        pos++;

        while (pos < input.length && isDigit(input[pos])) {
          numStr += input[pos];
          pos++;
        }
      }

      // Parse optional type annotation
      if (pos < input.length && isLetter(input[pos])) {
        let typeStr = "";
        while (pos < input.length && isLetter(input[pos])) {
          typeStr += input[pos];
          pos++;
        }

        // Parse type numbers (e.g., U8, I32)
        while (pos < input.length && isDigit(input[pos])) {
          typeStr += input[pos];
          pos++;
        }

        const validateResult = validateType(typeStr);
        if (!validateResult.ok) {
          return validateResult;
        }

        numStr += typeStr;
      }

      tokens.push({ type: "NUMBER", value: numStr });
    } else {
      return err(`Unexpected character: ${char}`);
    }
  }

  tokens.push({ type: "EOF" });
  return ok(tokens);
}

interface Parser {
  tokens: Token[];
  pos: number;
}

function current(parser: Parser): Token {
  if (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    return tok || { type: "EOF" };
  }
  return { type: "EOF" };
}

function advance(parser: Parser): void {
  parser.pos++;
}

function parseExpression(parser: Parser): Result<ASTNode, string> {
  return parseAdditive(parser);
}

function parseBinaryExpression(
  parser: Parser,
  // eslint-disable-next-line no-unused-vars
  parseOperand: (p: Parser) => Result<ASTNode, string>,
  operators: Set<"+" | "-" | "*" | "/">,
): Result<ASTNode, string> {
  let left = parseOperand(parser);
  if (!left.ok) {
    return left;
  }

  let node = left.value;

  while (true) {
    const tok = current(parser);
    if (
      tok.type !== "OPERATOR" ||
      !operators.has(tok.value as "+" | "-" | "*" | "/")
    ) {
      break;
    }

    const operator = tok.value as "+" | "-" | "*" | "/";
    advance(parser);

    const right = parseOperand(parser);
    if (!right.ok) {
      return right;
    }

    node = { kind: "binary", left: node, operator, right: right.value };
  }

  return ok(node);
}

function parseAdditive(parser: Parser): Result<ASTNode, string> {
  return parseBinaryExpression(
    parser,
    parseMultiplicative,
    new Set(["+", "-"]),
  );
}

function parseMultiplicative(parser: Parser): Result<ASTNode, string> {
  return parseBinaryExpression(parser, parsePrimary, new Set(["*", "/"]));
}

function parsePrimary(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  if (tok.type === "NUMBER") {
    advance(parser);
    return ok({ kind: "number", value: tok.value });
  }

  if (tok.type === "IDENTIFIER" && tok.value === "read") {
    advance(parser);
    const lt = current(parser);
    if (lt.type !== "LT") {
      return err("Expected '<' after read");
    }
    advance(parser);

    const typeTok = current(parser);
    if (typeTok.type !== "IDENTIFIER") {
      return err("Expected type after 'read<'");
    }
    const typeStr = typeTok.value;
    const validateResult = validateType(typeStr);
    if (!validateResult.ok) {
      return validateResult;
    }
    advance(parser);

    const gt = current(parser);
    if (gt.type !== "GT") {
      return err("Expected '>' after type");
    }
    advance(parser);

    const lparen = current(parser);
    if (lparen.type !== "LPAREN") {
      return err("Expected '(' after read<TYPE>");
    }
    advance(parser);

    const rparen = current(parser);
    if (rparen.type !== "RPAREN") {
      return err("Expected ')' after read<TYPE>(");
    }
    advance(parser);

    return ok({ kind: "read", type: typeStr });
  }

  if (tok.type === "LPAREN") {
    advance(parser);
    const expr = parseExpression(parser);
    if (!expr.ok) {
      return expr;
    }

    const closing = current(parser);
    if (closing.type !== "RPAREN") {
      return err("Expected closing parenthesis");
    }

    advance(parser);
    return ok(expr.value);
  }

  return err(`Unexpected token: ${tok.type}`);
}

function extractNumberValue(numericLiteral: string): string {
  let pos = 0;
  let result = "";

  // Handle optional sign
  if (pos < numericLiteral.length && numericLiteral[pos] === "-") {
    result += "-";
    pos++;
  }

  // Extract digits
  while (pos < numericLiteral.length && isDigit(numericLiteral[pos])) {
    result += numericLiteral[pos];
    pos++;
  }

  // Extract optional decimal part
  if (pos < numericLiteral.length && numericLiteral[pos] === ".") {
    result += ".";
    pos++;

    while (pos < numericLiteral.length && isDigit(numericLiteral[pos])) {
      result += numericLiteral[pos];
      pos++;
    }
  }

  return result || "0";
}

function getTypeFromLiteral(numericLiteral: string): string | undefined {
  let pos = 0;

  // Skip sign and digits
  if (pos < numericLiteral.length && numericLiteral[pos] === "-") {
    pos++;
  }

  while (pos < numericLiteral.length && isDigit(numericLiteral[pos])) {
    pos++;
  }

  // Skip decimal if present
  if (pos < numericLiteral.length && numericLiteral[pos] === ".") {
    pos++;

    while (pos < numericLiteral.length && isDigit(numericLiteral[pos])) {
      pos++;
    }
  }

  // Extract type
  if (pos < numericLiteral.length) {
    return numericLiteral.substring(pos);
  }

  return undefined;
}

function validateNegativeType(literal: string): Result<undefined, string> {
  if (!literal.startsWith("-")) {
    return ok(undefined);
  }

  const type = getTypeFromLiteral(literal);
  if (type && !type.startsWith("I") && !type.startsWith("F")) {
    return err(`Cannot apply negative sign to unsigned type: ${literal}`);
  }

  return ok(undefined);
}

function codegenAST(node: ASTNode): string {
  if (node.kind === "number") {
    // Extract numeric part, stripping type annotation
    return extractNumberValue(node.value);
  }

  if (node.kind === "read") {
    return "readValue()";
  }

  if (node.kind === "binary") {
    const left = codegenAST(node.left);
    const right = codegenAST(node.right);
    return `(${left} ${node.operator} ${right})`;
  }

  return "0";
}

function validateAST(node: ASTNode): Result<undefined, string> {
  if (node.kind === "number") {
    return validateNegativeType(node.value);
  }

  if (node.kind === "read") {
    return ok(undefined);
  }

  if (node.kind === "binary") {
    const leftValidation = validateAST(node.left);
    if (!leftValidation.ok) {
      return leftValidation;
    }

    return validateAST(node.right);
  }

  return ok(undefined);
}

export function compile(input: string): Result<string, string> {
  // Empty input returns 0
  if (input === "") {
    return ok("return 0;");
  }

  // Reject leading or trailing whitespace
  if (input !== input.trim()) {
    return err("Leading or trailing whitespace is not allowed");
  }

  // Tokenize
  const tokenResult = tokenize(input);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  // Parse
  const tokens = tokenResult.value;
  const parser: Parser = { tokens, pos: 0 };
  const astResult = parseExpression(parser);
  if (!astResult.ok) {
    return astResult;
  }

  // Check all tokens consumed
  if (current(parser).type !== "EOF") {
    return err("Unexpected tokens after expression");
  }

  // Validate AST
  const ast = astResult.value;
  const validationResult = validateAST(ast);
  if (!validationResult.ok) {
    return validationResult;
  }

  // Generate code
  const code = codegenAST(ast);

  return ok(`return ${code};`);
}

export const compileTuffToJS = compile;
