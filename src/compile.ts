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
  "Bool",
]);

// Token interfaces
interface NumberToken {
  type: "NUMBER";
  value: string;
}

interface OperatorToken {
  type: "OPERATOR";
  value: "+" | "-" | "*" | "/" | "%";
}

interface BoolToken {
  type: "BOOL";
  value: "true" | "false";
}

interface ComparisonToken {
  type: "COMPARISON";
  value: "<" | ">" | "<=" | ">=" | "==" | "!=";
}

interface LogicalToken {
  type: "LOGICAL";
  value: "&&" | "||" | "!";
}

interface IdentifierToken {
  type: "IDENTIFIER";
  value: string;
}

interface KeywordToken {
  type: "KEYWORD";
  value: "let" | "mut" | "if" | "else" | "while" | "break" | "continue";
}

interface LParenToken {
  type: "LPAREN";
}

interface RParenToken {
  type: "RPAREN";
}

interface LTToken {
  type: "LT";
}

interface GTToken {
  type: "GT";
}

interface ColonToken {
  type: "COLON";
}

interface SemicolonToken {
  type: "SEMICOLON";
}

interface AssignToken {
  type: "ASSIGN";
}

interface PlusAssignToken {
  type: "PLUS_ASSIGN";
}

interface MinusAssignToken {
  type: "MINUS_ASSIGN";
}

interface MultAssignToken {
  type: "MULT_ASSIGN";
}

interface DivAssignToken {
  type: "DIV_ASSIGN";
}

interface ModAssignToken {
  type: "MOD_ASSIGN";
}

interface LBraceToken {
  type: "LBRACE";
}

interface RBraceToken {
  type: "RBRACE";
}

interface EOFToken {
  type: "EOF";
}

type Token =
  | NumberToken
  | OperatorToken
  | IdentifierToken
  | KeywordToken
  | BoolToken
  | ComparisonToken
  | LogicalToken
  | LParenToken
  | RParenToken
  | LBraceToken
  | RBraceToken
  | LTToken
  | GTToken
  | ColonToken
  | SemicolonToken
  | AssignToken
  | PlusAssignToken
  | MinusAssignToken
  | MultAssignToken
  | DivAssignToken
  | ModAssignToken
  | EOFToken;

// AST node interfaces
interface NumberNode {
  kind: "number";
  value: string;
}

interface ReadNode {
  kind: "read";
  type: string;
}

interface VariableNode {
  kind: "variable";
  name: string;
}

interface BinaryNode {
  kind: "binary";
  left: ASTNode;
  operator: "+" | "-" | "*" | "/" | "%";
  right: ASTNode;
}

interface ComparisonNode {
  kind: "comparison";
  left: ASTNode;
  operator: "<" | ">" | "<=" | ">=" | "==" | "!=";
  right: ASTNode;
}

interface LogicalNode {
  kind: "logical";
  operator: "&&" | "||";
  left: ASTNode;
  right: ASTNode;
}

interface UnaryLogicalNode {
  kind: "unary-logical";
  operator: "!";
  operand: ASTNode;
}

interface BooleanNode {
  kind: "boolean";
  value: boolean;
}

interface LetNode {
  kind: "let";
  mutable: boolean;
  name: string;
  type: string;
  initializer: ASTNode;
}

interface AssignNode {
  kind: "assign";
  name: string;
  value: ASTNode;
}

interface BlockNode {
  kind: "block";
  statements: ASTNode[];
  result: ASTNode;
}

interface IfNode {
  kind: "if";
  condition: ASTNode;
  thenBranch: ASTNode;
  elseBranch: ASTNode | undefined;
}

interface WhileNode {
  kind: "while";
  condition: ASTNode;
  body: ASTNode;
}

interface BreakNode {
  kind: "break";
}

interface ContinueNode {
  kind: "continue";
}

type ASTNode =
  | NumberNode
  | ReadNode
  | VariableNode
  | BinaryNode
  | ComparisonNode
  | LogicalNode
  | UnaryLogicalNode
  | BooleanNode
  | LetNode
  | AssignNode
  | BlockNode
  | IfNode
  | WhileNode
  | BreakNode
  | ContinueNode;

// Variable info interface
interface VariableInfo {
  type: string;
  mutable: boolean;
}

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

function getVariable(
  parser: Parser,
  name: string,
): Result<VariableInfo, string> {
  const varInfo = parser.variables.get(name);
  if (!varInfo) {
    return err(`Variable '${name}' is not defined`);
  }
  return ok(varInfo);
}

function parseTypeAnnotation(parser: Parser): Result<string, string> {
  const typeTok = current(parser);
  if (typeTok.type !== "IDENTIFIER") {
    return err("Expected type annotation");
  }
  const typeStr = typeTok.value;
  const validateResult = validateType(typeStr);
  if (!validateResult.ok) {
    return validateResult;
  }
  advance(parser);
  return ok(typeStr);
}

function parseTypeValue(parser: Parser): Result<string, string> {
  const typeTok = current(parser);
  if (typeTok.type !== "IDENTIFIER") {
    return err("Expected type");
  }
  const typeStr = typeTok.value;
  const validateResult = validateType(typeStr);
  if (!validateResult.ok) {
    return validateResult;
  }
  return ok(typeStr);
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
      last !== undefined &&
      (last.type === "NUMBER" ||
        last.type === "RPAREN" ||
        last.type === "IDENTIFIER" ||
        last.type === "BOOL" ||
        last.type === "GT")
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
      // Check for +=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "PLUS_ASSIGN" });
        pos += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "+" });
        pos++;
      }
    } else if (char === "-" && isOperatorContext()) {
      // Check for -=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "MINUS_ASSIGN" });
        pos += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "-" });
        pos++;
      }
    } else if (char === "*" && isOperatorContext()) {
      // Check for *=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "MULT_ASSIGN" });
        pos += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "*" });
        pos++;
      }
    } else if (char === "/" && isOperatorContext()) {
      // Check for /=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "DIV_ASSIGN" });
        pos += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "/" });
        pos++;
      }
    } else if (char === "%" && isOperatorContext()) {
      // Check for %=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "MOD_ASSIGN" });
        pos += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "%" });
        pos++;
      }
    } else if (char === "(") {
      tokens.push({ type: "LPAREN" });
      pos++;
    } else if (char === ")") {
      tokens.push({ type: "RPAREN" });
      pos++;
    } else if (char === "{") {
      tokens.push({ type: "LBRACE" });
      pos++;
    } else if (char === "}") {
      tokens.push({ type: "RBRACE" });
      pos++;
    } else if (char === "<") {
      // Check for <=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "COMPARISON", value: "<=" });
        pos += 2;
      } else {
        tokens.push({ type: "COMPARISON", value: "<" });
        pos++;
      }
    } else if (char === ">") {
      // Check for >=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "COMPARISON", value: ">=" });
        pos += 2;
      } else {
        tokens.push({ type: "COMPARISON", value: ">" });
        pos++;
      }
    } else if (char === ":") {
      tokens.push({ type: "COLON" });
      pos++;
    } else if (char === ";") {
      tokens.push({ type: "SEMICOLON" });
      pos++;
    } else if (char === "=") {
      // Check for ==
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "COMPARISON", value: "==" });
        pos += 2;
      } else {
        tokens.push({ type: "ASSIGN" });
        pos++;
      }
    } else if (char === "!") {
      // Check for !=
      if (pos + 1 < input.length && input[pos + 1] === "=") {
        tokens.push({ type: "COMPARISON", value: "!=" });
        pos += 2;
      } else {
        tokens.push({ type: "LOGICAL", value: "!" });
        pos++;
      }
    } else if (char === "&") {
      // Check for &&
      if (pos + 1 < input.length && input[pos + 1] === "&") {
        tokens.push({ type: "LOGICAL", value: "&&" });
        pos += 2;
      } else {
        return err("Unexpected character: &");
      }
    } else if (char === "|") {
      // Check for ||
      if (pos + 1 < input.length && input[pos + 1] === "|") {
        tokens.push({ type: "LOGICAL", value: "||" });
        pos += 2;
      } else {
        return err("Unexpected character: |");
      }
    } else if (isLetter(char)) {
      // Parse identifier (e.g., 'read', 'let', 'mut', or type like 'U8')
      let ident = "";
      while (
        pos < input.length &&
        (isLetter(input[pos]) || isDigit(input[pos]))
      ) {
        ident += input[pos];
        pos++;
      }

      // Check if it's a keyword or boolean
      if (
        ident === "let" ||
        ident === "mut" ||
        ident === "if" ||
        ident === "else" ||
        ident === "while" ||
        ident === "break" ||
        ident === "continue"
      ) {
        tokens.push({ type: "KEYWORD", value: ident });
      } else if (ident === "true") {
        tokens.push({ type: "BOOL", value: "true" });
      } else if (ident === "false") {
        tokens.push({ type: "BOOL", value: "false" });
      } else {
        tokens.push({ type: "IDENTIFIER", value: ident });
      }
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
  variables: Map<string, VariableInfo>;
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

function tryParseAssignment(
  parser: Parser,
): Result<ASTNode | undefined, string> {
  const tok = current(parser);

  if (tok.type !== "IDENTIFIER") {
    return ok(undefined);
  }

  const savedPos = parser.pos;
  const name = tok.value;
  advance(parser);

  const nextTok = current(parser);

  // Check if it's a compound assignment operator
  const compoundOperators = new Set([
    "PLUS_ASSIGN",
    "MINUS_ASSIGN",
    "MULT_ASSIGN",
    "DIV_ASSIGN",
    "MOD_ASSIGN",
  ]);

  let isCompound = false;
  let operator: "+" | "-" | "*" | "/" | "%" = "+";

  if (compoundOperators.has(nextTok.type)) {
    isCompound = true;
    // Map compound operators to binary operators
    const operatorMap: Record<string, "+" | "-" | "*" | "/" | "%"> = {
      PLUS_ASSIGN: "+",
      MINUS_ASSIGN: "-",
      MULT_ASSIGN: "*",
      DIV_ASSIGN: "/",
      MOD_ASSIGN: "%",
    };
    operator = operatorMap[nextTok.type] || "+";
    advance(parser);
  } else if (nextTok.type === "ASSIGN") {
    // Regular assignment
    advance(parser);
  } else {
    // Not an assignment, restore position
    parser.pos = savedPos;
    return ok(undefined);
  }

  const varResult = getVariable(parser, name);
  if (!varResult.ok) {
    return varResult;
  }
  if (!varResult.value.mutable) {
    return err(`Variable '${name}' is immutable and cannot be reassigned`);
  }

  const valueResult = parseExpression(parser);
  if (!valueResult.ok) {
    return valueResult;
  }

  let assignValue = valueResult.value;

  // For compound assignments, wrap in a binary operation
  if (isCompound) {
    const binaryNode: BinaryNode = {
      kind: "binary",
      left: { kind: "variable", name },
      operator,
      right: valueResult.value,
    };
    assignValue = binaryNode;
  }

  return ok({
    kind: "assign",
    name,
    value: assignValue,
  });
}

function consumeOptionalSemicolon(parser: Parser): void {
  if (current(parser).type === "SEMICOLON") {
    advance(parser);
  }
}

function parseStatementBlock(
  parser: Parser,
  statements: ASTNode[],
  stopOnRbrace: boolean = true,
): Result<void, string> {
  while (true) {
    const tok = current(parser);
    if (tok.type === "EOF" || (stopOnRbrace && tok.type === "RBRACE")) {
      break;
    }

    const stmtResult = parseStatementInBlock(parser, statements);
    if (!stmtResult.ok) {
      return stmtResult;
    }

    if (!stmtResult.value) {
      // Not a statement, break to parse expression
      break;
    }
  }
  return ok(undefined);
}

function parseStatementInBlock(
  parser: Parser,
  statements: ASTNode[],
): Result<boolean, string> {
  const stmtTok = current(parser);

  if (stmtTok.type === "KEYWORD" && stmtTok.value === "let") {
    const stmt = parseLetStatement(parser);
    if (!stmt.ok) {
      return stmt;
    }
    statements.push(stmt.value);
    return ok(true);
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "if") {
    // Nested if statement
    const ifStmt = parseIfStatement(parser);
    if (!ifStmt.ok) {
      return ifStmt;
    }
    statements.push(ifStmt.value);
    consumeOptionalSemicolon(parser);
    return ok(true);
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "while") {
    // While loop statement
    const whileStmt = parseWhileStatement(parser);
    if (!whileStmt.ok) {
      return whileStmt;
    }
    statements.push(whileStmt.value);
    consumeOptionalSemicolon(parser);
    return ok(true);
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "break") {
    // Break statement
    const breakStmt = parseBreakStatement(parser);
    if (!breakStmt.ok) {
      return breakStmt;
    }
    statements.push(breakStmt.value);
    consumeOptionalSemicolon(parser);
    return ok(true);
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "continue") {
    // Continue statement
    const continueStmt = parseContinueStatement(parser);
    if (!continueStmt.ok) {
      return continueStmt;
    }
    statements.push(continueStmt.value);
    consumeOptionalSemicolon(parser);
    return ok(true);
  } else if (stmtTok.type === "IDENTIFIER") {
    // Could be assignment - use helper
    const assignResult = tryParseAssignment(parser);
    if (!assignResult.ok) {
      return assignResult;
    }

    if (assignResult.value !== undefined) {
      statements.push(assignResult.value);
      consumeOptionalSemicolon(parser);
      return ok(true);
    } else {
      // Not an assignment
      return ok(false);
    }
  } else {
    return ok(false);
  }
}

function parseParenthesizedCondition(parser: Parser): Result<ASTNode, string> {
  // Expect '('
  const lparen = current(parser);
  if (lparen.type !== "LPAREN") {
    return err("Expected '('");
  }
  advance(parser);

  // Parse condition
  const conditionResult = parseExpression(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  // Expect ')'
  const rparen = current(parser);
  if (rparen.type !== "RPAREN") {
    return err("Expected ')'");
  }
  advance(parser);

  return conditionResult;
}

function parseBlockStatements(parser: Parser): Result<ASTNode[], string> {
  // Expect '{'
  if (current(parser).type !== "LBRACE") {
    return err("Expected '{'");
  }
  advance(parser);

  const statements: ASTNode[] = [];
  const blockResult = parseStatementBlock(parser, statements);
  if (!blockResult.ok) {
    return blockResult;
  }

  // Expect '}'
  if (current(parser).type !== "RBRACE") {
    return err("Expected '}'");
  }
  advance(parser);

  return ok(statements);
}

function createBlockBodyWithOptionalExpression(
  statements: ASTNode[],
  parser: Parser,
): Result<ASTNode, string> {
  if (statements.length === 0) {
    return ok({ kind: "number", value: "0" });
  }

  // Parse the final expression in the block (if any)
  const resultTok = current(parser);
  if (
    resultTok.type !== "RBRACE" &&
    resultTok.type !== "SEMICOLON" &&
    resultTok.type !== "KEYWORD" &&
    resultTok.type !== "IDENTIFIER" &&
    resultTok.type !== "EOF"
  ) {
    const exprResult = parseExpression(parser);
    if (!exprResult.ok) {
      return exprResult;
    }
    return ok({ kind: "block", statements, result: exprResult.value });
  }

  return ok({
    kind: "block",
    statements,
    result: { kind: "number", value: "0" },
  });
}

function createSimpleBlockNode(statements: ASTNode[]): ASTNode {
  if (statements.length === 0) {
    return { kind: "number", value: "0" };
  }

  return {
    kind: "block",
    statements,
    result: { kind: "number", value: "0" },
  };
}

function parseIfStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'if'
  const ifTok = current(parser);
  if (ifTok.type !== "KEYWORD" || ifTok.value !== "if") {
    return err("Expected 'if'");
  }
  advance(parser);

  // Parse condition
  const conditionResult = parseParenthesizedCondition(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  // Parse then branch (single statement or block)
  const thenResult = parseIfBody(parser);
  if (!thenResult.ok) {
    return thenResult;
  }

  // Check for else
  const elseTok = current(parser);
  let elseBranch: ASTNode | undefined = undefined;

  if (elseTok.type === "KEYWORD" && elseTok.value === "else") {
    advance(parser);

    // else can be followed by another if (else if) or a body
    const nextTok = current(parser);
    if (nextTok.type === "KEYWORD" && nextTok.value === "if") {
      // else if - recursively parse another if
      const elseIfResult = parseIfStatement(parser);
      if (!elseIfResult.ok) {
        return elseIfResult;
      }
      elseBranch = elseIfResult.value;
    } else {
      // else body
      const elseBodyResult = parseIfBody(parser);
      if (!elseBodyResult.ok) {
        return elseBodyResult;
      }
      elseBranch = elseBodyResult.value;
    }
  }

  return ok({
    kind: "if",
    condition: conditionResult.value,
    thenBranch: thenResult.value,
    elseBranch,
  });
}

function parseIfBody(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  // Block body
  if (tok.type === "LBRACE") {
    const stmtsResult = parseBlockStatements(parser);
    if (!stmtsResult.ok) {
      return stmtsResult;
    }

    return createBlockBodyWithOptionalExpression(stmtsResult.value, parser);
  } else {
    // Single statement body - could be break, continue, assignment, or expression
    const tok = current(parser);

    // Check for break statement
    if (tok.type === "KEYWORD" && tok.value === "break") {
      const breakStmt = parseBreakStatement(parser);
      if (!breakStmt.ok) {
        return breakStmt;
      }
      return breakStmt;
    }

    // Check for continue statement
    if (tok.type === "KEYWORD" && tok.value === "continue") {
      const continueStmt = parseContinueStatement(parser);
      if (!continueStmt.ok) {
        return continueStmt;
      }
      return continueStmt;
    }

    // Try assignment
    const assignResult = tryParseAssignment(parser);
    if (!assignResult.ok) {
      return assignResult;
    }

    if (assignResult.value !== undefined) {
      return ok(assignResult.value);
    }

    // Parse as expression
    const exprResult = parseExpression(parser);
    if (!exprResult.ok) {
      return exprResult;
    }
    return exprResult;
  }
}

function parseWhileStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'while'
  const whileTok = current(parser);
  if (whileTok.type !== "KEYWORD" || whileTok.value !== "while") {
    return err("Expected 'while'");
  }
  advance(parser);

  // Parse condition
  const conditionResult = parseParenthesizedCondition(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  // Parse body (single statement or block)
  const bodyTok = current(parser);
  let bodyResult: Result<ASTNode, string>;

  if (bodyTok.type === "LBRACE") {
    // Block body
    const stmtsResult = parseBlockStatements(parser);
    if (!stmtsResult.ok) {
      return stmtsResult;
    }

    bodyResult = ok(createSimpleBlockNode(stmtsResult.value));
  } else {
    // Single statement body
    const statements: ASTNode[] = [];
    const stmtResult = parseStatementInBlock(parser, statements);
    if (!stmtResult.ok) {
      return stmtResult;
    }

    if (stmtResult.value && statements.length === 1) {
      bodyResult = ok(statements[0] as ASTNode);
    } else if (stmtResult.value && statements.length > 1) {
      bodyResult = ok({
        kind: "block",
        statements,
        result: { kind: "number", value: "0" },
      });
    } else {
      return err("Expected statement or block in while body");
    }
  }

  if (!bodyResult.ok) {
    return bodyResult;
  }

  return ok({
    kind: "while",
    condition: conditionResult.value,
    body: bodyResult.value,
  });
}

function parseBreakStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'break'
  const breakTok = current(parser);
  if (breakTok.type !== "KEYWORD" || breakTok.value !== "break") {
    return err("Expected 'break'");
  }
  advance(parser);

  return ok({ kind: "break" });
}

function parseContinueStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'continue'
  const continueTok = current(parser);
  if (continueTok.type !== "KEYWORD" || continueTok.value !== "continue") {
    return err("Expected 'continue'");
  }
  advance(parser);

  return ok({ kind: "continue" });
}

function parseProgram(parser: Parser): Result<ASTNode, string> {
  const statements: ASTNode[] = [];

  // Parse all let and assignment statements and if statements
  const blockResult = parseStatementBlock(parser, statements, false);
  if (!blockResult.ok) {
    return blockResult;
  }

  // Parse final expression
  const expr = parseExpression(parser);
  if (!expr.ok) {
    return expr;
  }

  if (statements.length === 0) {
    return expr;
  }

  return ok({ kind: "block", statements, result: expr.value });
}

function parseLetStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'let'
  const letTok = current(parser);
  if (letTok.type !== "KEYWORD" || letTok.value !== "let") {
    return err("Expected 'let'");
  }
  advance(parser);

  // Check for 'mut'
  let mutable = false;
  const mutTok = current(parser);
  if (mutTok.type === "KEYWORD" && mutTok.value === "mut") {
    mutable = true;
    advance(parser);
  }

  // Expect identifier
  const nameTok = current(parser);
  if (nameTok.type !== "IDENTIFIER") {
    return err("Expected variable name");
  }
  const name = nameTok.value;
  advance(parser);

  // Check for duplicate declaration
  if (parser.variables.has(name)) {
    return err(`Variable '${name}' already declared`);
  }

  // Expect ':'
  const colonTok = current(parser);
  if (colonTok.type !== "COLON") {
    return err("Expected ':' after variable name");
  }
  advance(parser);

  // Parse type annotation
  const typeResult = parseTypeAnnotation(parser);
  if (!typeResult.ok) {
    return typeResult;
  }
  const typeStr = typeResult.value;

  // Expect '='
  const assignTok = current(parser);
  if (assignTok.type !== "ASSIGN") {
    return err("Expected '=' in let statement");
  }
  advance(parser);

  // Parse initializer expression
  const initResult = parseExpression(parser);
  if (!initResult.ok) {
    return initResult;
  }

  // Check type compatibility for numeric literals
  const initializer = initResult.value;
  if (initializer.kind === "number") {
    // Check if negative literal is assigned to unsigned type
    if (
      initializer.value.startsWith("-") &&
      !typeStr.startsWith("I") &&
      !typeStr.startsWith("F")
    ) {
      return err(`Cannot assign negative value to unsigned type '${typeStr}'`);
    }
  }

  // Expect ';'
  const semiTok = current(parser);
  if (semiTok.type !== "SEMICOLON") {
    return err("Expected ';' after let statement");
  }
  advance(parser);

  // Register variable in parser context
  parser.variables.set(name, { type: typeStr, mutable });

  return ok({
    kind: "let",
    mutable,
    name,
    type: typeStr,
    initializer,
  });
}

function parseExpression(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  // Check for if expression
  if (tok.type === "KEYWORD" && tok.value === "if") {
    return parseIfStatement(parser);
  }

  return parseLogicalOr(parser);
}

interface ParseBinaryConfig {
  // eslint-disable-next-line no-unused-vars
  nextParser: (p: Parser) => Result<ASTNode, string>;
  // eslint-disable-next-line no-unused-vars
  tokenMatcher: (tok: Token) => boolean;
  // eslint-disable-next-line no-unused-vars
  operatorExtractor: (tok: Token) => string;
  nodeMaker: (
    // eslint-disable-next-line no-unused-vars
    operator: string,
    // eslint-disable-next-line no-unused-vars
    left: ASTNode,
    // eslint-disable-next-line no-unused-vars
    right: ASTNode,
  ) => BinaryNode | ComparisonNode | LogicalNode;
}

function parseBinary(
  parser: Parser,
  config: ParseBinaryConfig,
): Result<ASTNode, string> {
  let left = config.nextParser(parser);
  if (!left.ok) {
    return left;
  }

  let node = left.value;

  while (true) {
    const tok = current(parser);
    if (!config.tokenMatcher(tok)) {
      break;
    }

    const operator = config.operatorExtractor(tok);
    advance(parser);

    const right = config.nextParser(parser);
    if (!right.ok) {
      return right;
    }

    node = config.nodeMaker(operator, node, right.value);
  }

  return ok(node);
}

function logicalNodeMaker(
  op: string,
  left: ASTNode,
  right: ASTNode,
): LogicalNode {
  return {
    kind: "logical",
    operator: op as "&&" | "||",
    left,
    right,
  };
}

function comparisonNodeMaker(
  op: string,
  left: ASTNode,
  right: ASTNode,
): ComparisonNode {
  return {
    kind: "comparison",
    operator: op as "<" | ">" | "<=" | ">=" | "==" | "!=",
    left,
    right,
  };
}

function parseLogicalOr(parser: Parser): Result<ASTNode, string> {
  return parseBinary(parser, {
    nextParser: parseLogicalAnd,
    tokenMatcher: (tok: Token) => tok.type === "LOGICAL" && tok.value === "||",
    operatorExtractor: (tok: Token) =>
      tok.type === "LOGICAL" ? tok.value : "",
    nodeMaker: logicalNodeMaker,
  });
}

function parseLogicalAnd(parser: Parser): Result<ASTNode, string> {
  return parseBinary(parser, {
    nextParser: parseComparison,
    tokenMatcher: (tok: Token) => tok.type === "LOGICAL" && tok.value === "&&",
    operatorExtractor: (tok: Token) =>
      tok.type === "LOGICAL" ? tok.value : "",
    nodeMaker: logicalNodeMaker,
  });
}

function parseComparison(parser: Parser): Result<ASTNode, string> {
  return parseBinary(parser, {
    nextParser: parseUnaryLogical,
    tokenMatcher: (tok: Token) => tok.type === "COMPARISON",
    operatorExtractor: (tok: Token) =>
      tok.type === "COMPARISON" ? tok.value : "",
    nodeMaker: comparisonNodeMaker,
  });
}

function parseUnaryLogical(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  if (tok.type === "LOGICAL" && tok.value === "!") {
    advance(parser);

    const operand = parseUnaryLogical(parser);
    if (!operand.ok) {
      return operand;
    }

    return ok({
      kind: "unary-logical",
      operator: "!",
      operand: operand.value,
    });
  }

  return parseAdditive(parser);
}

function parseBinaryOperator(
  parser: Parser,
  // eslint-disable-next-line no-unused-vars
  nextParser: (p: Parser) => Result<ASTNode, string>,
  operators: Set<string>,
  castType: "+" | "-" | "*" | "/",
): Result<ASTNode, string> {
  return parseBinary(parser, {
    nextParser,
    tokenMatcher: (tok: Token) =>
      tok.type === "OPERATOR" && operators.has(tok.value),
    operatorExtractor: (tok: Token) => (tok as OperatorToken).value,
    nodeMaker: (
      operator: string,
      left: ASTNode,
      right: ASTNode,
    ): BinaryNode => ({
      kind: "binary",
      operator: operator as typeof castType,
      left,
      right,
    }),
  });
}

function parseAdditive(parser: Parser): Result<ASTNode, string> {
  return parseBinaryOperator(
    parser,
    parseMultiplicative,
    new Set(["+", "-"]),
    "+" as "+" | "-",
  );
}

function parseMultiplicative(parser: Parser): Result<ASTNode, string> {
  return parseBinaryOperator(
    parser,
    parsePrimary,
    new Set(["*", "/"]),
    "*" as "*" | "/",
  );
}

function parsePrimary(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  if (tok.type === "NUMBER") {
    advance(parser);
    return ok({ kind: "number", value: tok.value });
  }

  if (tok.type === "BOOL") {
    advance(parser);
    return ok({ kind: "boolean", value: tok.value === "true" });
  }

  if (tok.type === "IDENTIFIER" && tok.value === "read") {
    advance(parser);
    const lt = current(parser);
    if (lt.type !== "COMPARISON" || (lt.value !== "<" && lt.value !== "<=")) {
      return err("Expected '<' after read");
    }
    if (lt.type === "COMPARISON" && lt.value === "<=") {
      return err("Expected '<' after read, not '<='");
    }
    advance(parser);

    const typeResult = parseTypeValue(parser);
    if (!typeResult.ok) {
      return typeResult;
    }
    const typeStr = typeResult.value;
    advance(parser);

    const gt = current(parser);
    if (gt.type !== "COMPARISON" || (gt.value !== ">" && gt.value !== ">=")) {
      return err("Expected '>' after type");
    }
    if (gt.type === "COMPARISON" && gt.value === ">=") {
      return err("Expected '>' after type, not '>='");
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

  if (tok.type === "IDENTIFIER") {
    const name = tok.value;
    advance(parser);

    // Variable reference - just check it exists
    const varResult = getVariable(parser, name);
    if (!varResult.ok) {
      return varResult;
    }

    return ok({ kind: "variable", name });
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

function generateStatementCode(statements: ASTNode[]): string {
  return statements
    .map((stmt) => {
      const code = codegenAST(stmt);
      return code.endsWith(";") ? code : code + ";";
    })
    .join(" ");
}

function codegenAST(node: ASTNode): string {
  if (node.kind === "number") {
    // Extract numeric part, stripping type annotation
    return extractNumberValue(node.value);
  }

  if (node.kind === "boolean") {
    // Convert boolean to number (1 for true, 0 for false)
    return node.value ? "1" : "0";
  }

  if (node.kind === "read") {
    return "readValue()";
  }

  if (node.kind === "variable") {
    return node.name;
  }

  if (node.kind === "let") {
    const init = codegenAST(node.initializer);
    return `let ${node.name} = ${init}`;
  }

  if (node.kind === "assign") {
    const value = codegenAST(node.value);
    return `${node.name} = ${value}`;
  }

  if (
    node.kind === "binary" ||
    node.kind === "comparison" ||
    node.kind === "logical"
  ) {
    const left = codegenAST(node.left);
    const right = codegenAST(node.right);
    return `(${left} ${node.operator} ${right})`;
  }

  if (node.kind === "unary-logical") {
    const operand = codegenAST(node.operand);
    return `(!${operand})`;
  }

  if (node.kind === "block") {
    const statements = generateStatementCode(node.statements);
    const result = codegenAST(node.result);
    return `${statements} return ${result}`;
  }

  if (node.kind === "if") {
    const condition = codegenAST(node.condition);

    let thenCode = "";
    if (node.thenBranch.kind === "block") {
      thenCode = generateStatementCode(node.thenBranch.statements);
    } else {
      thenCode = codegenAST(node.thenBranch);
    }

    if (node.elseBranch === undefined) {
      // if without else - used as statement
      return `if (${condition}) { ${thenCode} }`;
    }

    // if with else - generate else branch code
    let elseCode = "";
    if (node.elseBranch.kind === "block") {
      // For block bodies, get just the statements
      elseCode = generateStatementCode(node.elseBranch.statements);
    } else if (node.elseBranch.kind === "if") {
      // else if - the recursive call will generate the correct syntax
      // For nested if nodes, we need to generate them as expressions if blocks are involved
      const innerIfCode = codegenAST(node.elseBranch);

      if (node.thenBranch.kind === "block") {
        // Then has statements, use if/else syntax
        return `if (${condition}) { ${thenCode} } else ${innerIfCode}`;
      } else {
        // Both are non-block expressions, so treat as full ternary
        return `(${condition} ? ${thenCode} : ${innerIfCode})`;
      }
    } else {
      elseCode = codegenAST(node.elseBranch);
    }

    // Check if both branches are simple expressions without statements or blocks
    if (node.thenBranch.kind !== "block" && node.elseBranch.kind !== "block") {
      // Both are simple expressions - use ternary
      return `(${condition} ? ${thenCode} : ${elseCode})`;
    } else {
      // At least one has statements - use if/else syntax
      return `if (${condition}) { ${thenCode} } else { ${elseCode} }`;
    }
  }

  if (node.kind === "while") {
    const condition = codegenAST(node.condition);
    let bodyCode = "";

    if (node.body.kind === "block") {
      bodyCode = generateStatementCode(node.body.statements);
    } else {
      bodyCode = codegenAST(node.body);
    }

    return `while (${condition}) { ${bodyCode} }`;
  }

  if (node.kind === "break") {
    return "break";
  }

  if (node.kind === "continue") {
    return "continue";
  }

  return "0";
}

function validateAST(node: ASTNode): Result<undefined, string> {
  if (node.kind === "number") {
    return validateNegativeType(node.value);
  }

  if (node.kind === "boolean") {
    return ok(undefined);
  }

  if (node.kind === "read" || node.kind === "variable") {
    return ok(undefined);
  }

  if (node.kind === "let") {
    return validateAST(node.initializer);
  }

  if (node.kind === "assign") {
    return validateAST(node.value);
  }

  if (
    node.kind === "binary" ||
    node.kind === "comparison" ||
    node.kind === "logical"
  ) {
    const leftValidation = validateAST(node.left);
    if (!leftValidation.ok) {
      return leftValidation;
    }

    return validateAST(node.right);
  }

  if (node.kind === "unary-logical") {
    return validateAST(node.operand);
  }

  if (node.kind === "block") {
    for (const stmt of node.statements) {
      const validation = validateAST(stmt);
      if (!validation.ok) {
        return validation;
      }
    }
    return validateAST(node.result);
  }

  if (node.kind === "if") {
    // Validate condition
    const condValidation = validateAST(node.condition);
    if (!condValidation.ok) {
      return condValidation;
    }

    // Validate then branch
    const thenValidation = validateAST(node.thenBranch);
    if (!thenValidation.ok) {
      return thenValidation;
    }

    // Validate else branch if present
    if (node.elseBranch !== undefined) {
      const elseValidation = validateAST(node.elseBranch);
      if (!elseValidation.ok) {
        return elseValidation;
      }
    }

    return ok(undefined);
  }

  if (node.kind === "while") {
    // Validate condition
    const condValidation = validateAST(node.condition);
    if (!condValidation.ok) {
      return condValidation;
    }

    // Validate body
    const bodyValidation = validateAST(node.body);
    if (!bodyValidation.ok) {
      return bodyValidation;
    }

    return ok(undefined);
  }

  if (node.kind === "break" || node.kind === "continue") {
    // Validation for break/continue will be done at parser level
    return ok(undefined);
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
  const parser: Parser = { tokens, pos: 0, variables: new Map() };
  const astResult = parseProgram(parser);
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

  // If the AST is a block, it already includes return statement
  if (ast.kind === "block") {
    return ok(code + ";");
  }

  return ok(`return ${code};`);
}

export const compileTuffToJS = compile;
