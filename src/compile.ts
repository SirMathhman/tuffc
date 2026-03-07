import { type Result, ok, err } from "./types";

const VALID_TYPES = new Set([
  "U8",
  "U16",
  "U32",
  "U64",
  "USize",
  "I8",
  "I16",
  "I32",
  "I64",
  "ISize",
  "F32",
  "F64",
  "Char",
  "Bool",
  "Void",
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

interface CharToken {
  type: "CHAR";
  value: string;
}

interface StringToken {
  type: "STRING";
  value: number[];
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
  value:
    | "let"
    | "mut"
    | "if"
    | "else"
    | "while"
    | "break"
    | "continue"
    | "match"
    | "case"
    | "fn"
    | "return"
    | "struct";
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

interface ArrowToken {
  type: "ARROW";
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

interface CommaToken {
  type: "COMMA";
}

interface DotToken {
  type: "DOT";
}

interface AddressOfToken {
  type: "ADDRESS_OF";
}

interface LBracketToken {
  type: "LBRACKET";
}

interface RBracketToken {
  type: "RBRACKET";
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
  | CharToken
  | StringToken
  | ComparisonToken
  | LogicalToken
  | LParenToken
  | RParenToken
  | LBraceToken
  | RBraceToken
  | LBracketToken
  | RBracketToken
  | LTToken
  | GTToken
  | ColonToken
  | SemicolonToken
  | ArrowToken
  | AssignToken
  | PlusAssignToken
  | MinusAssignToken
  | MultAssignToken
  | DivAssignToken
  | ModAssignToken
  | CommaToken
  | DotToken
  | AddressOfToken
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

interface UnaryOpNode {
  kind: "unary-op";
  operator: "*" | "&" | "&mut";
  operand: ASTNode;
}

interface BooleanNode {
  kind: "boolean";
  value: boolean;
}

interface CharNode {
  kind: "char";
  value: string;
}

interface StringNode {
  kind: "string";
  value: number[];
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

interface FieldAssignNode {
  kind: "field-assign";
  object: ASTNode;
  fieldName: string;
  value: ASTNode;
}

interface DerefAssignNode {
  kind: "deref-assign";
  target: ASTNode;
  value: ASTNode;
  targetVar?: string; // The name of the variable being assigned (for pointers)
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

interface ReturnNode {
  kind: "return";
  value: ASTNode;
}

interface CasePattern {
  type: "literal" | "boolean" | "wildcard";
  value?: string | boolean; // value for literals/booleans, undefined for wildcard
}

interface MatchCase {
  pattern: CasePattern;
  result: ASTNode;
}

interface MatchNode {
  kind: "match";
  matchExpr: ASTNode;
  cases: MatchCase[];
}

interface FunctionParameter {
  name: string;
  type: string;
}

interface FunctionNode {
  kind: "function";
  name: string;
  parameters: FunctionParameter[];
  returnType: string;
  body: ASTNode;
}

interface ClosureNode {
  kind: "closure";
  parameters: FunctionParameter[];
  returnType: string;
  body: ASTNode;
}

interface FunctionCallNode {
  kind: "function-call";
  name: string;
  arguments: ASTNode[];
}

interface StructField {
  name: string;
  type: string;
  mutable: boolean;
}

interface StructNode {
  kind: "struct";
  name: string;
  fields: StructField[];
}

interface StructInstantiationField {
  name: string;
  value: ASTNode;
}

interface StructInstantiationNode {
  kind: "struct-instantiation";
  structName: string;
  fields: StructInstantiationField[];
}

interface FieldAccessNode {
  kind: "field-access";
  object: ASTNode;
  fieldName: string;
}

interface ArrayLiteralNode {
  kind: "array-literal";
  elements: ASTNode[];
  generator?: ASTNode;
  repeatCount?: number;
  elemType?: string;
}

interface ArrayAccessNode {
  kind: "array-access";
  array: ASTNode;
  index: ASTNode;
}

interface ArraySliceNode {
  kind: "array-slice";
  array: ASTNode;
  start: number;
  end: number;
}

interface ArrayAssignNode {
  kind: "array-assign";
  array: ASTNode;
  index: ASTNode;
  value: ASTNode;
}

type ASTNode =
  | NumberNode
  | ReadNode
  | VariableNode
  | BinaryNode
  | ComparisonNode
  | LogicalNode
  | UnaryLogicalNode
  | UnaryOpNode
  | BooleanNode
  | CharNode
  | StringNode
  | LetNode
  | AssignNode
  | FieldAssignNode
  | DerefAssignNode
  | BlockNode
  | IfNode
  | WhileNode
  | BreakNode
  | ContinueNode
  | ReturnNode
  | MatchNode
  | FunctionNode
  | ClosureNode
  | FunctionCallNode
  | StructNode
  | StructInstantiationNode
  | FieldAccessNode
  | ArrayLiteralNode
  | ArrayAccessNode
  | ArraySliceNode
  | ArrayAssignNode;

// Refinement type interfaces
interface RefinementConstraint {
  operator: "<" | ">" | "<=" | ">=" | "==" | "!=";
  value: string; // The constraint value (as string literal, for backward compat)
  valueExpr?: ASTNode; // The constraint value as an expression (for variables/arithmetic)
  baseType?: string; // For multi-constraint like "I32 > 0 && I32 < 100", track base type
  isOr?: boolean; // True if this constraint is OR'd with the previous one
}

interface RefinementType {
  baseType: string;
  constraints: RefinementConstraint[];
}

// Variable info interface
interface VariableInfo {
  type: string;
  mutable: boolean;
  refinement?: RefinementType; // Optional refinement constraints
  initValue?: string; // The literal value (for constants), if available
  pointsTo?: string; // For pointers: the name of the variable it points to
  sliceLength?: number; // For slices: known compile-time length
}

interface SuccessfulEvaluation {
  success: true;
  value: number;
}

interface FailedEvaluation {
  success: false;
}

type EvaluationResult = SuccessfulEvaluation | FailedEvaluation;

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

function isPrimitiveNumericType(typeStr: string): boolean {
  return (
    VALID_TYPES.has(typeStr) &&
    typeStr !== "Bool" &&
    typeStr !== "Void" &&
    typeStr !== "Char"
  );
}

function areTypesCompatible(expectedType: string, actualType: string): boolean {
  if (expectedType === actualType) {
    return true;
  }

  if (
    expectedType === "Bool" ||
    actualType === "Bool" ||
    expectedType === "Void" ||
    actualType === "Void" ||
    expectedType === "Char" ||
    actualType === "Char"
  ) {
    return false;
  }

  if (expectedType.startsWith("F") && actualType.startsWith("F")) {
    return true;
  }

  return (
    isPrimitiveNumericType(expectedType) && isPrimitiveNumericType(actualType)
  );
}

interface TokenizedCharLiteral {
  token: CharToken;
  nextPos: number;
}

interface TokenizedStringLiteral {
  token: StringToken;
  nextPos: number;
}

function readEscapedCharValue(
  char: string | undefined,
): Result<number, string> {
  if (char === undefined) {
    return err("Unterminated character literal");
  }

  if (char === "n") return ok(10);
  if (char === "t") return ok(9);
  if (char === "r") return ok(13);
  if (char === "0") return ok(0);
  if (char === "'") return ok(39);
  if (char === '"') return ok(34);
  if (char === "\\") return ok(92);

  return err("Invalid escape sequence '\\" + char + "' in character literal");
}

function tokenizeCharLiteral(
  input: string,
  startPos: number,
): Result<TokenizedCharLiteral, string> {
  const contentPos = startPos + 1;
  if (contentPos >= input.length) {
    return err("Unterminated character literal");
  }

  if (input[contentPos] === "'") {
    return err("Empty character literal is not allowed");
  }

  let charValue = 0;
  let nextPos = contentPos;

  if (input[nextPos] === "\\") {
    const escapedValue = readEscapedCharValue(input[nextPos + 1]);
    if (!escapedValue.ok) {
      return escapedValue;
    }
    charValue = escapedValue.value;
    nextPos += 2;
  } else {
    const codePoint = input.codePointAt(nextPos);
    if (codePoint === undefined) {
      return err("Unterminated character literal");
    }
    charValue = codePoint;
    nextPos += codePoint > 65535 ? 2 : 1;
  }

  if (nextPos >= input.length) {
    return err("Unterminated character literal");
  }

  if (input[nextPos] !== "'") {
    return err("Character literal must contain exactly one character");
  }

  return ok({
    token: { type: "CHAR", value: String(charValue) },
    nextPos: nextPos + 1,
  });
}

function tokenizeStringLiteral(
  input: string,
  startPos: number,
): Result<TokenizedStringLiteral, string> {
  const codePoints: number[] = [];
  let pos = startPos + 1;

  while (pos < input.length) {
    const char = input[pos];
    if (char === '"') {
      return ok({
        token: { type: "STRING", value: codePoints },
        nextPos: pos + 1,
      });
    }

    if (char === "\\") {
      const escapedValue = readEscapedCharValue(input[pos + 1]);
      if (!escapedValue.ok) {
        return escapedValue;
      }
      codePoints.push(escapedValue.value);
      pos += 2;
      continue;
    }

    const codePoint = input.codePointAt(pos);
    if (codePoint === undefined) {
      return err("Unterminated string literal");
    }
    codePoints.push(codePoint);
    pos += codePoint > 65535 ? 2 : 1;
  }

  return err("Unterminated string literal");
}

function validateType(typeStr: string): Result<undefined, string> {
  return VALID_TYPES.has(typeStr)
    ? ok(undefined)
    : err("Invalid type annotation: " + typeStr);
}

function validateTypeWithStructs(
  parser: Parser,
  typeStr: string,
): Result<undefined, string> {
  if (parser.structs.has(typeStr)) return ok(undefined);
  return validateType(typeStr);
}

interface ParsedFunctionType {
  parameterTypes: string[];
  returnType: string;
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let currentPart = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  for (const char of text) {
    if (char === "(") {
      parenDepth++;
    } else if (char === ")") {
      parenDepth--;
    } else if (char === "[") {
      bracketDepth++;
    } else if (char === "]") {
      bracketDepth--;
    }

    if (char === separator && parenDepth === 0 && bracketDepth === 0) {
      parts.push(currentPart.trim());
      currentPart = "";
    } else {
      currentPart += char;
    }
  }

  if (currentPart.trim().length > 0 || text.length === 0) {
    parts.push(currentPart.trim());
  }

  return parts;
}

function parseFunctionTypeString(
  typeStr: string,
): ParsedFunctionType | undefined {
  const trimmed = typeStr.trim();
  if (!trimmed.startsWith("(")) {
    return undefined;
  }

  let depth = 0;
  let closingParenIndex = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "(") depth++;
    if (char === ")") {
      depth--;
      if (depth === 0) {
        closingParenIndex = i;
        break;
      }
    }
  }

  if (closingParenIndex === -1) {
    return undefined;
  }

  const afterParen = trimmed.slice(closingParenIndex + 1).trim();
  if (!afterParen.startsWith("=>")) {
    return undefined;
  }

  const returnType = afterParen.slice(2).trim();
  const paramsText = trimmed.slice(1, closingParenIndex).trim();
  const parameterTypes =
    paramsText.length === 0 ? [] : splitTopLevel(paramsText, ",");

  return {
    parameterTypes,
    returnType,
  };
}

function ensureExpressionType(
  parser: Parser,
  expr: ASTNode,
  expectedType: string,
): Result<undefined, string> {
  const exprTypeResult = inferExpressionType(expr, parser);
  if (!exprTypeResult.ok) {
    return exprTypeResult;
  }
  if (exprTypeResult.value !== expectedType) {
    return err(
      "Type mismatch: expression has type '" +
        exprTypeResult.value +
        "' but variable declared as '" +
        expectedType +
        "'",
    );
  }
  return ok(undefined);
}

function inferReferenceType(
  parser: Parser,
  operand: ASTNode,
  operator: "&" | "&mut",
): Result<string, string> {
  const prefix = operator === "&mut" ? "*mut " : "*";

  if (operand.kind === "array-slice") {
    const operandTypeResult = inferExpressionType(operand, parser);
    if (!operandTypeResult.ok) {
      return operandTypeResult;
    }
    return ok(prefix + operandTypeResult.value);
  }

  if (operand.kind !== "variable") {
    return err("Cannot take address of non-variable expression");
  }

  const arrayInfo = getArrayLikeInfo(operand, parser);
  if (arrayInfo && !arrayInfo.isSlice) {
    return ok(prefix + "[" + arrayInfo.elementType + "]");
  }

  const operandTypeResult = inferExpressionType(operand, parser);
  if (!operandTypeResult.ok) {
    return operandTypeResult;
  }
  return ok(prefix + operandTypeResult.value);
}

function getBracketedTypeInner(typeStr: string): string | undefined {
  if (!typeStr.startsWith("[") || !typeStr.endsWith("]")) {
    return undefined;
  }
  return typeStr.slice(1, -1);
}

function getBracketedTypeParts(typeStr: string): string[] | undefined {
  const inner = getBracketedTypeInner(typeStr);
  return inner === undefined ? undefined : splitTopLevel(inner, ";");
}

function applyPointerDecorators(
  baseType: string,
  pointerDepth: number,
  isMutable: boolean,
): string {
  let typeStr = baseType;
  for (let i = 0; i < pointerDepth; i++) {
    if (i === pointerDepth - 1 && isMutable) {
      typeStr = "*mut " + typeStr;
    } else {
      typeStr = "*" + typeStr;
    }
  }
  return typeStr;
}

function consumeCommaOrClosingParen(
  parser: Parser,
  errorMessage: string,
): Result<undefined, string> {
  if (current(parser).type === "COMMA") {
    advance(parser);
    return ok(undefined);
  }
  if (current(parser).type !== "RPAREN") {
    return err(errorMessage);
  }
  return ok(undefined);
}

function parseFunctionParameters(
  parser: Parser,
  rejectShadowing: boolean,
): Result<FunctionParameter[], string> {
  const parameters: FunctionParameter[] = [];
  const parameterNames = new Set<string>();

  while (current(parser).type !== "RPAREN") {
    const paramNameTok = current(parser);
    if (paramNameTok.type !== "IDENTIFIER") {
      return err("Expected parameter name");
    }

    const paramName = paramNameTok.value;
    const paramKeywordCheck = checkReservedKeyword(paramName, "parameter name");
    if (!paramKeywordCheck.ok) {
      return paramKeywordCheck;
    }
    if (parameterNames.has(paramName)) {
      return err("Duplicate parameter name '" + paramName + "'");
    }
    if (rejectShadowing && parser.variables.has(paramName)) {
      return err(
        "Parameter name '" + paramName + "' shadows a captured variable",
      );
    }
    parameterNames.add(paramName);
    advance(parser);

    if (current(parser).type !== "COLON") {
      return err("Expected ':' after parameter name");
    }
    advance(parser);

    const paramTypeResult = parseTypeAnnotation(parser);
    if (!paramTypeResult.ok) {
      return paramTypeResult;
    }
    parameters.push({ name: paramName, type: paramTypeResult.value });

    const separatorResult = consumeCommaOrClosingParen(
      parser,
      "Expected ',' or ')' in parameter list",
    );
    if (!separatorResult.ok) {
      return separatorResult;
    }
  }

  if (current(parser).type !== "RPAREN") {
    return err("Expected ')' after parameter list");
  }
  advance(parser);

  return ok(parameters);
}

function canStartClosureParameterList(parser: Parser): boolean {
  if (current(parser).type === "RPAREN") {
    return true;
  }

  if (current(parser).type !== "IDENTIFIER") {
    return false;
  }

  const nextTok = parser.tokens[parser.pos + 1];
  return nextTok?.type === "COLON";
}

function codegenFunctionLikeDeclaration(
  name: string | undefined,
  parameters: FunctionParameter[],
  returnType: string,
  body: ASTNode,
): string {
  const paramList = parameters
    .map((parameter) => String(parameter.name))
    .join(", ");
  const bodyCode = codegenFunctionLikeBody(body, returnType);
  const functionName = name ? " " + name : "";
  const suffix = name ? ";" : "";
  return (
    "function" +
    functionName +
    "(" +
    paramList +
    ") { " +
    bodyCode +
    " }" +
    suffix
  );
}

function codegenFunctionLikeBody(body: ASTNode, returnType: string): string {
  let bodyCode = "";

  if (body.kind === "block") {
    const statements = body.statements;
    bodyCode = generateStatementCode(statements);
    const lastStmt =
      statements.length > 0 ? statements[statements.length - 1] : undefined;
    if (!(lastStmt && lastStmt.kind === "return")) {
      if (returnType === "Void") {
        if (body.result.kind !== "number" || body.result.value !== "0") {
          bodyCode += codegenAST(body.result);
        }
      } else {
        bodyCode += "return " + codegenAST(body.result);
      }
    }
    return bodyCode;
  }

  if (returnType === "Void") {
    return codegenAST(body);
  }

  return "return " + codegenAST(body);
}

// Infer the type of an expression
function inferExpressionType(
  expr: ASTNode,
  parser: Parser,
): Result<string, string> {
  if (expr.kind === "array-slice") {
    const arrayInfo = getArrayLikeInfo(expr.array, parser);
    if (!arrayInfo) {
      return err("Cannot infer element type of array slice");
    }
    return ok("[" + arrayInfo.elementType + "]");
  }

  if (expr.kind === "number") {
    const numValue = expr.value;
    let typeStr = "";
    for (let i = numValue.length - 1; i >= 0; i--) {
      if (isLetter(numValue[i]) || numValue[i] === "_") {
        typeStr = numValue[i] + typeStr;
      } else {
        break;
      }
    }
    return ok(typeStr || "I32");
  }

  if (expr.kind === "boolean") {
    return ok("Bool");
  }

  if (expr.kind === "char") {
    return ok("Char");
  }

  if (expr.kind === "string") {
    return ok("*[Char]");
  }

  if (expr.kind === "variable") {
    const varResult = getVariable(parser, expr.name);
    if (!varResult.ok) {
      return varResult;
    }
    return ok(varResult.value.type);
  }

  if (expr.kind === "unary-op") {
    if (expr.operator === "&" || expr.operator === "&mut") {
      return inferReferenceType(parser, expr.operand, expr.operator);
    }

    if (expr.operator === "*") {
      const operandTypeResult = inferExpressionType(expr.operand, parser);
      if (!operandTypeResult.ok) {
        return operandTypeResult;
      }
      const ptrType = operandTypeResult.value;
      if (!ptrType.startsWith("*")) {
        return err("Cannot dereference non-pointer type: " + ptrType);
      }
      return ok(
        ptrType.startsWith("*mut ") ? ptrType.slice(5) : ptrType.slice(1),
      );
    }
  }

  if (
    expr.kind === "binary" ||
    expr.kind === "comparison" ||
    expr.kind === "logical"
  ) {
    const leftTypeResult = inferExpressionType(expr.left, parser);
    if (!leftTypeResult.ok) {
      return leftTypeResult;
    }
    const rightTypeResult = inferExpressionType(expr.right, parser);
    if (!rightTypeResult.ok) {
      return rightTypeResult;
    }

    if (
      leftTypeResult.value.startsWith("*") ||
      rightTypeResult.value.startsWith("*")
    ) {
      return err("Pointer arithmetic not supported");
    }

    return leftTypeResult;
  }

  if (expr.kind === "read") {
    return ok(expr.type);
  }

  if (expr.kind === "closure") {
    const paramTypes = expr.parameters.map((param) => param.type).join(", ");
    return ok("(" + paramTypes + ") => " + expr.returnType);
  }

  if (expr.kind === "function-call") {
    const fnInfo = parser.functions.get(expr.name);
    if (fnInfo) {
      return ok(fnInfo.returnType);
    }

    const varResult = getVariable(parser, expr.name);
    if (varResult.ok) {
      const parsedFunctionType = parseFunctionTypeString(varResult.value.type);
      if (parsedFunctionType) {
        return ok(parsedFunctionType.returnType);
      }
    }

    return err("Cannot infer return type of callable '" + expr.name + "'");
  }

  if (expr.kind === "array-access") {
    const arrayInfo = getArrayLikeInfo(expr.array, parser);
    if (arrayInfo) {
      return ok(arrayInfo.elementType);
    }
    return err("Cannot infer element type of array access");
  }

  if (expr.kind === "field-access" && expr.fieldName === "length") {
    return ok("USize");
  }

  if (expr.kind === "if") {
    return inferExpressionType(expr.thenBranch, parser);
  }

  return err("Cannot infer type of expression");
}

function getVariable(
  parser: Parser,
  name: string,
): Result<VariableInfo, string> {
  const varInfo = parser.variables.get(name);
  if (!varInfo) {
    return err("Variable '" + name + "' is not defined");
  }
  return ok(varInfo);
}

function parseTypeAnnotation(parser: Parser): Result<string, string> {
  // Count and consume any leading * for pointer types
  let pointerDepth = 0;
  let isMutable = false;
  while (
    current(parser).type === "OPERATOR" &&
    (current(parser) as OperatorToken).value === "*"
  ) {
    pointerDepth++;
    advance(parser);

    // Check for 'mut' keyword after *
    if (tryConsumeMutKeyword(parser)) {
      isMutable = true;
      break; // mut can only appear once, after the last *
    }
  }

  // Check for array or slice value type [ElementType; Length] / [ElementType]
  if (current(parser).type === "LBRACKET") {
    advance(parser); // consume [

    // Parse element type recursively (can be nested arrays)
    const elemTypeResult = parseTypeAnnotation(parser);
    if (!elemTypeResult.ok) {
      return elemTypeResult;
    }
    const elemType = elemTypeResult.value;

    if (current(parser).type === "RBRACKET") {
      advance(parser);
      return ok(
        applyPointerDecorators("[" + elemType + "]", pointerDepth, isMutable),
      );
    }

    // Expect ;
    if (current(parser).type !== "SEMICOLON") {
      return err("Expected ';' after array element type");
    }
    advance(parser);

    // Parse array length
    const lengthTok = current(parser);
    if (lengthTok.type !== "NUMBER") {
      return err("Expected array length as number");
    }
    const lengthValue = (lengthTok as NumberToken).value;
    if (!isBareNonNegativeIntegerLiteral(lengthValue)) {
      return err("Expected array length as a non-negative integer literal");
    }
    advance(parser);

    // Expect ]
    if (current(parser).type !== "RBRACKET") {
      return err("Expected ']' to close array type");
    }
    advance(parser);

    return ok(
      applyPointerDecorators(
        "[" + elemType + ";" + lengthValue + "]",
        pointerDepth,
        isMutable,
      ),
    );
  }

  // Function type: (T1, T2) => R
  if (current(parser).type === "LPAREN") {
    advance(parser); // consume '('

    const parameterTypes: string[] = [];
    while (current(parser).type !== "RPAREN") {
      const paramTypeResult = parseTypeAnnotation(parser);
      if (!paramTypeResult.ok) {
        return paramTypeResult;
      }
      parameterTypes.push(paramTypeResult.value);

      const separatorResult = consumeCommaOrClosingParen(
        parser,
        "Expected ',' or ')' in function type",
      );
      if (!separatorResult.ok) {
        return err("Expected ',' or ')' in function type");
      }
    }

    if (current(parser).type !== "RPAREN") {
      return err("Expected ')' after function type parameters");
    }
    advance(parser);

    if (current(parser).type !== "ARROW") {
      return err("Expected '=>' in function type");
    }
    advance(parser);

    const returnTypeResult = parseTypeAnnotation(parser);
    if (!returnTypeResult.ok) {
      return returnTypeResult;
    }

    const typeStr = applyPointerDecorators(
      "(" + parameterTypes.join(", ") + ") => " + returnTypeResult.value,
      pointerDepth,
      isMutable,
    );

    return ok(typeStr);
  }

  const typeTok = current(parser);
  if (typeTok.type !== "IDENTIFIER") {
    return err("Expected type annotation");
  }
  const baseType = (typeTok as IdentifierToken).value;
  const validateResult = validateTypeWithStructs(parser, baseType);
  if (!validateResult.ok) {
    return validateResult;
  }
  advance(parser);

  // Construct pointer type string: e.g., "*I32", "*mut I32", "**I32", "*mut *I32"
  return ok(applyPointerDecorators(baseType, pointerDepth, isMutable));
}

function parseTypeValue(parser: Parser): Result<string, string> {
  const typeTok = current(parser);
  // Delegate array types to parseTypeAnnotation, but step back one so
  // the caller's advance() moves past the last token correctly.
  if (typeTok.type === "LBRACKET" || typeTok.type === "LPAREN") {
    const result = parseTypeAnnotation(parser);
    if (!result.ok) return result;
    // parseTypeAnnotation advanced past ']'; step back one so caller's advance() is correct
    parser.pos -= 1;
    return result;
  }
  if (typeTok.type !== "IDENTIFIER") {
    return err("Expected type");
  }
  const typeStr = typeTok.value;
  const validateResult = validateTypeWithStructs(parser, typeStr);
  if (!validateResult.ok) {
    return validateResult;
  }
  return ok(typeStr);
}

// Refinement type parsing
function parseRefinementConstraint(
  parser: Parser,
  baseType: string,
): Result<RefinementConstraint, string> {
  const opTok = current(parser);

  // Check for comparison operator
  if (opTok.type !== "COMPARISON") {
    return err("Expected comparison operator in refinement constraint");
  }

  const operator = opTok.value as "<" | ">" | "<=" | ">=" | "==" | "!=";
  advance(parser);

  // Parse constraint value expression (can be variable, literal, arithmetic, function call, etc.)
  const exprResult = parseAdditive(parser);
  if (!exprResult.ok) {
    return exprResult;
  }

  // For backward compatibility, extract string representation if it's a simple literal
  let value = "?"; // default placeholder
  if (exprResult.value.kind === "number") {
    value = exprResult.value.value;
  } else if (exprResult.value.kind === "variable") {
    value = exprResult.value.name;
  }

  return ok({
    operator,
    value,
    valueExpr: exprResult.value, // Store the full expression
    baseType,
  });
}

// Parse refinement type like "I32 > 100" or "I32 > 0 && I32 < 1000"
function parseRefinementType(
  parser: Parser,
  baseType: string,
): Result<RefinementType | undefined, string> {
  // Check if next token is a comparison operator (start of refinement)
  const tok = current(parser);
  if (tok.type !== "COMPARISON") {
    // No refinement, just the base type
    return ok(undefined);
  }

  const constraints: RefinementConstraint[] = [];

  // Parse first constraint
  const firstConstraintResult = parseRefinementConstraint(parser, baseType);
  if (!firstConstraintResult.ok) {
    return firstConstraintResult;
  }
  constraints.push(firstConstraintResult.value);

  // Parse additional constraints with && or ||
  while (true) {
    const nextTok = current(parser);
    let isOrOp = false;

    if (nextTok.type === "LOGICAL" && nextTok.value === "&&") {
      advance(parser); // consume &&
      isOrOp = false;
    } else if (nextTok.type === "LOGICAL" && nextTok.value === "||") {
      advance(parser); // consume ||
      isOrOp = true;
    } else {
      // No more constraints
      break;
    }

    // Expect another base type identifier
    const typeTok = current(parser);
    if (typeTok.type !== "IDENTIFIER") {
      return err("Expected type in chained constraint");
    }
    const nextBaseType = typeTok.value;
    if (nextBaseType !== baseType) {
      const opType = isOrOp ? "OR" : "AND";
      return err(
        "All constraints in " + opType + " must reference the same base type",
      );
    }
    advance(parser); // consume type identifier

    const constraintResult = parseRefinementConstraint(parser, baseType);
    if (!constraintResult.ok) {
      return constraintResult;
    }
    // Mark with appropriate operator
    constraintResult.value.isOr = isOrOp;
    constraints.push(constraintResult.value);
  }

  return ok({
    baseType,
    constraints,
  });
}

// Validate if a number satisfies refinement constraints
function validateConstraints(
  value: string,
  refinement: RefinementType,
  variables?: Map<string, VariableInfo>,
  parser?: Parser,
): boolean {
  // Parse the numeric value
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return false; // Can't validate non-numeric values
  }

  // Build groups of constraints separated by OR
  // Constraints with isOr=true are OR'd with the previous group
  let currentAndGroup: RefinementConstraint[] = [];
  let constraintGroups: RefinementConstraint[][] = [];

  for (const constraint of refinement.constraints) {
    if (constraint.isOr) {
      // Start new OR group
      if (currentAndGroup.length > 0) {
        constraintGroups.push(currentAndGroup);
        currentAndGroup = [];
      }
    }
    currentAndGroup.push(constraint);
  }
  if (currentAndGroup.length > 0) {
    constraintGroups.push(currentAndGroup);
  }

  // If no groups were created (all AND), validate all constraints
  if (constraintGroups.length === 0) {
    for (const constraint of refinement.constraints) {
      if (!validateSingleConstraint(numValue, constraint, variables, parser)) {
        return false;
      }
    }
    return true;
  }

  // If we have groups (OR), at least one group must be fully satisfied
  for (const group of constraintGroups) {
    let groupSatisfied = true;
    for (const constraint of group) {
      if (!validateSingleConstraint(numValue, constraint, variables, parser)) {
        groupSatisfied = false;
        break;
      }
    }
    if (groupSatisfied) {
      return true; // At least one OR group is satisfied
    }
  }

  return false;
}

// Try to evaluate an expression to a number at compile-time given variable context
function tryEvaluateExpression(
  expr: ASTNode,
  variables: Map<string, VariableInfo>,
  parser: Parser,
): EvaluationResult {
  // Base case: numeric literal
  if (expr.kind === "number") {
    const num = Number(expr.value);
    return isNaN(num) ? { success: false } : { success: true, value: num };
  }

  // Variable reference - look it up and try to use its known value
  if (expr.kind === "variable") {
    const varInfo = variables.get(expr.name);
    if (!varInfo || !varInfo.initValue) {
      // Can't evaluate if variable not found or value not tracked
      return { success: false };
    }
    // Evaluate the stored initialization value
    const num = Number(varInfo.initValue);
    return isNaN(num) ? { success: false } : { success: true, value: num };
  }

  // Binary operations (arithmetic)
  if (expr.kind === "binary") {
    const leftEval = tryEvaluateExpression(expr.left, variables, parser);
    const rightEval = tryEvaluateExpression(expr.right, variables, parser);

    if (
      !leftEval.success ||
      !rightEval.success ||
      leftEval.value === undefined ||
      rightEval.value === undefined
    ) {
      return { success: false };
    }

    const left = leftEval.value as number;
    const right = rightEval.value as number;
    let result = 0;

    switch (expr.operator) {
      case "+":
        result = left + right;
        break;
      case "-":
        result = left - right;
        break;
      case "*":
        result = left * right;
        break;
      case "/":
        if (right === 0) return { success: false };
        result = left / right;
        break;
      case "%":
        if (right === 0) return { success: false };
        result = left % right;
        break;
      default:
        return { success: false };
    }

    return { success: true, value: result };
  }

  // Other expressions can't be evaluated at compile-time
  return { success: false };
}

function validateSingleConstraint(
  numValue: number,
  constraint: RefinementConstraint,
  variables?: Map<string, VariableInfo>,
  parser?: Parser,
): boolean {
  // Try to evaluate the constraint value
  let constraintVal: number;

  if (constraint.valueExpr && variables && parser) {
    // Evaluate expression
    const evalResult = tryEvaluateExpression(
      constraint.valueExpr,
      variables,
      parser,
    );
    if (!evalResult.success || evalResult.value === undefined) {
      // Can't evaluate - fail the constraint
      return false;
    }
    constraintVal = evalResult.value as number;
  } else {
    // Fall back to string representation
    constraintVal = Number(constraint.value);
    if (isNaN(constraintVal)) {
      return false;
    }
  }

  let satisfied = false;
  switch (constraint.operator) {
    case ">":
      satisfied = numValue > constraintVal;
      break;
    case "<":
      satisfied = numValue < constraintVal;
      break;
    case ">=":
      satisfied = numValue >= constraintVal;
      break;
    case "<=":
      satisfied = numValue <= constraintVal;
      break;
    case "==":
      satisfied = numValue === constraintVal;
      break;
    case "!=":
      satisfied = numValue !== constraintVal;
      break;
  }
  return satisfied;
}

// Extract refinement constraints from a comparison expression (for type narrowing)
// e.g., "x > 100" yields { baseType: "I32", constraints: [{ operator: ">", value: "100" }] }
function extractConstraintsFromComparison(
  condition: ASTNode,
  parser: Parser,
): Map<string, RefinementType> {
  const constraints = new Map<string, RefinementType>();

  if (condition.kind === "comparison") {
    const comp = condition as ComparisonNode;

    // Simple case: variable OP value, e.g., x > 100
    if (
      comp.left.kind === "variable" &&
      (comp.right.kind === "number" || comp.right.kind === "variable")
    ) {
      const varName = comp.left.name;
      const varInfo = parser.variables.get(varName);

      if (varInfo) {
        const rightValue =
          comp.right.kind === "number"
            ? (comp.right as NumberNode).value
            : (comp.right as VariableNode).name;

        const refinement: RefinementType = {
          baseType: varInfo.type,
          constraints: [
            {
              operator: comp.operator,
              value: rightValue,
              baseType: varInfo.type,
            },
          ],
        };
        constraints.set(varName, refinement);
      }
    }
    // Reverse case: value OP variable, e.g., 100 < x
    else if (
      comp.right.kind === "variable" &&
      (comp.left.kind === "number" || comp.left.kind === "variable")
    ) {
      const varName = comp.right.name;
      const varInfo = parser.variables.get(varName);

      if (varInfo) {
        const leftValue =
          comp.left.kind === "number"
            ? (comp.left as NumberNode).value
            : (comp.left as VariableNode).name;

        // Flip the operator: 100 < x becomes x > 100
        const flippedOp = flightConstraintOperator(comp.operator);
        const refinement: RefinementType = {
          baseType: varInfo.type,
          constraints: [
            {
              operator: flippedOp,
              value: leftValue,
              baseType: varInfo.type,
            },
          ],
        };
        constraints.set(varName, refinement);
      }
    }
  } else if (condition.kind === "logical") {
    const logic = condition as LogicalNode;

    if (logic.operator === "&&") {
      // Combine constraints from both sides
      const leftConstraints = extractConstraintsFromComparison(
        logic.left,
        parser,
      );
      const rightConstraints = extractConstraintsFromComparison(
        logic.right,
        parser,
      );

      // Merge constraints for the same variable
      for (const [varName, refinement] of leftConstraints) {
        constraints.set(varName, refinement);
      }
      for (const [varName, refinement] of rightConstraints) {
        const existing = constraints.get(varName);
        if (existing && existing.baseType === refinement.baseType) {
          // Combine AND constraints
          existing.constraints.push(...refinement.constraints);
        } else {
          constraints.set(varName, refinement);
        }
      }
    }
    // TODO: Handle OR constraints for type narrowing (more complex)
  }

  return constraints;
}

// Flip comparison operator for constraint extraction (e.g., < becomes >)
function flightConstraintOperator(
  op: "<" | ">" | "<=" | ">=" | "==" | "!=",
): "<" | ">" | "<=" | ">=" | "==" | "!=" {
  switch (op) {
    case "<":
      return ">";
    case ">":
      return "<";
    case "<=":
      return ">=";
    case ">=":
      return "<=";
    default:
      return op; // == and != remain the same
  }
}

// Check if a variable can be assigned to a refined type given current proven constraints
function canAssignToRefinedType(
  varName: string,
  requiredRefinement: RefinementType,
  parser: Parser,
): boolean {
  // Check if we have proof for this variable
  const varInfo = parser.variables.get(varName);

  // If the variable has a known initialization value (literal), use that to prove the constraint
  if (varInfo && varInfo.initValue) {
    return validateConstraints(
      varInfo.initValue,
      requiredRefinement,
      parser.variables,
      parser,
    );
  }

  // Check if we have proven constraints for this variable
  const proven = parser.provenConstraints.get(varName);

  if (!proven) {
    // No proven constraints - can't assign
    return false;
  }

  // Check if proven constraints satisfy the required refinement
  if (proven.baseType !== requiredRefinement.baseType) {
    return false; // Type mismatch
  }

  // For each required constraint, check if it's proven
  // This is a simplified check: proven constraints must exactly match required ones
  // (or be stricter, but that's complex to determine for expression-based constraints)
  for (const reqConstraint of requiredRefinement.constraints) {
    let found = false;
    for (const provenConstraint of proven.constraints) {
      // Try to match constraints by evaluating them
      // First try simple string match
      if (
        provenConstraint.operator === reqConstraint.operator &&
        provenConstraint.value === reqConstraint.value
      ) {
        found = true;
        break;
      }

      // If mismatch try evaluating proven constraint to see if it's equivalent
      if (provenConstraint.operator === reqConstraint.operator) {
        // Both are same operator, evaluate the values
        let provenVal: number | undefined;
        let reqVal: number | undefined;

        if (provenConstraint.valueExpr) {
          const evalResult = tryEvaluateExpression(
            provenConstraint.valueExpr,
            parser.variables,
            parser,
          );
          if (evalResult.success && evalResult.value !== undefined) {
            provenVal = evalResult.value as number;
          }
        } else {
          const val = Number(provenConstraint.value);
          if (!isNaN(val)) provenVal = val;
        }

        if (reqConstraint.valueExpr) {
          const evalResult = tryEvaluateExpression(
            reqConstraint.valueExpr,
            parser.variables,
            parser,
          );
          if (evalResult.success && evalResult.value !== undefined) {
            reqVal = evalResult.value as number;
          }
        } else {
          const val = Number(reqConstraint.value);
          if (!isNaN(val)) reqVal = val;
        }

        if (
          provenVal !== undefined &&
          reqVal !== undefined &&
          provenVal === reqVal
        ) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return false; // Required constraint not proven
    }
  }

  return true;
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
        last.type === "RBRACKET" ||
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

    if (char === "'") {
      const charTokenResult = tokenizeCharLiteral(input, pos);
      if (!charTokenResult.ok) {
        return charTokenResult;
      }
      tokens.push(charTokenResult.value.token);
      pos = charTokenResult.value.nextPos;
      continue;
    }

    if (char === '"') {
      const stringTokenResult = tokenizeStringLiteral(input, pos);
      if (!stringTokenResult.ok) {
        return stringTokenResult;
      }
      tokens.push(stringTokenResult.value.token);
      pos = stringTokenResult.value.nextPos;
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
    } else if (char === "*") {
      // Handle * as either multiplication operator or dereference operator
      if (isOperatorContext()) {
        // Check for *=
        if (pos + 1 < input.length && input[pos + 1] === "=") {
          tokens.push({ type: "MULT_ASSIGN" });
          pos += 2;
        } else {
          tokens.push({ type: "OPERATOR", value: "*" });
          pos++;
        }
      } else {
        // * in prefix context is dereference operator (used in *y or pointer types *I32)
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
    } else if (char === "[") {
      tokens.push({ type: "LBRACKET" });
      pos++;
    } else if (char === "]") {
      tokens.push({ type: "RBRACKET" });
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
    } else if (char === ",") {
      tokens.push({ type: "COMMA" });
      pos++;
    } else if (char === ".") {
      tokens.push({ type: "DOT" });
      pos++;
    } else if (char === "=") {
      // Check for => (arrow)
      if (pos + 1 < input.length && input[pos + 1] === ">") {
        tokens.push({ type: "ARROW" });
        pos += 2;
      } else if (pos + 1 < input.length && input[pos + 1] === "=") {
        // Check for ==
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
        // Single & is address-of operator
        tokens.push({ type: "ADDRESS_OF" });
        pos++;
      }
    } else if (char === "|") {
      // Check for ||
      if (pos + 1 < input.length && input[pos + 1] === "|") {
        tokens.push({ type: "LOGICAL", value: "||" });
        pos += 2;
      } else {
        return err("Unexpected character: |");
      }
    } else if (isLetter(char) || char === "_") {
      // Parse identifier (e.g., 'read', 'let', 'mut', type like 'U8', or wildcard '_')
      let ident = "";
      while (
        pos < input.length &&
        (isLetter(input[pos]) || isDigit(input[pos]) || input[pos] === "_")
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
        ident === "continue" ||
        ident === "match" ||
        ident === "case" ||
        ident === "fn" ||
        ident === "return" ||
        ident === "struct"
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
      if (
        pos < input.length &&
        input[pos] === "." &&
        pos + 1 < input.length &&
        isDigit(input[pos + 1])
      ) {
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
      return err("Unexpected character: " + char);
    }
  }

  tokens.push({ type: "EOF" });
  return ok(tokens);
}

interface FunctionInfo {
  parameters: FunctionParameter[];
  returnType: string;
}

interface StructInfo {
  fields: StructField[];
}

interface Parser {
  tokens: Token[];
  pos: number;
  variables: Map<string, VariableInfo>;
  functions: Map<string, FunctionInfo>;
  structs: Map<string, StructInfo>;
  inLoop: boolean;
  currentFunctionReturnType: string | undefined;
  // Type narrowing: track variables with proven constraints (from control flow guards)
  provenConstraints: Map<string, RefinementType>; // e.g., "x" -> I32 > 100
}

interface ParsedNumberLiteral {
  numericPart: string;
  typeAnnotation: string;
}

interface ParsedArrayType {
  elementType: string;
  length: number;
}

interface ParsedSliceType {
  elementType: string;
}

interface ParsedSliceReferenceType {
  elementType: string;
  mutable: boolean;
}

interface ArrayLikeInfo {
  elementType: string;
  length: number | undefined;
  mutable: boolean;
  isSlice: boolean;
}

function splitNumberLiteral(value: string): ParsedNumberLiteral {
  let pos = 0;

  if (value[pos] === "-") {
    pos++;
  }

  while (pos < value.length && isDigit(value[pos])) {
    pos++;
  }

  if (value[pos] === ".") {
    pos++;
    while (pos < value.length && isDigit(value[pos])) {
      pos++;
    }
  }

  return {
    numericPart: value.slice(0, pos),
    typeAnnotation: value.slice(pos),
  };
}

function isBareNonNegativeIntegerLiteral(value: string): boolean {
  const numericPart = splitNumberLiteral(value).numericPart;
  if (numericPart.length === 0) {
    return false;
  }

  for (const char of numericPart) {
    if (char < "0" || char > "9") {
      return false;
    }
  }

  return true;
}

function parseArrayType(typeStr: string): ParsedArrayType | undefined {
  const parts = getBracketedTypeParts(typeStr);
  if (!parts) {
    return undefined;
  }

  if (parts.length !== 2) {
    return undefined;
  }

  const length = Number(parts[1]);
  if (!Number.isInteger(length)) {
    return undefined;
  }

  return {
    elementType: parts[0] ?? "",
    length,
  };
}

function parseSliceType(typeStr: string): ParsedSliceType | undefined {
  const parts = getBracketedTypeParts(typeStr);
  if (!parts) {
    return undefined;
  }
  if (parts.length !== 1) {
    return undefined;
  }

  const elementType = (parts[0] ?? "").trim();
  return elementType.length === 0 ? undefined : { elementType };
}

function parseSliceReferenceType(
  typeStr: string,
): ParsedSliceReferenceType | undefined {
  if (typeStr.startsWith("*mut ")) {
    const sliceType = parseSliceType(typeStr.slice(5));
    return sliceType
      ? { elementType: sliceType.elementType, mutable: true }
      : undefined;
  }

  if (typeStr.startsWith("*")) {
    const sliceType = parseSliceType(typeStr.slice(1));
    return sliceType
      ? { elementType: sliceType.elementType, mutable: false }
      : undefined;
  }

  return undefined;
}

function getArrayLikeInfo(
  node: ASTNode,
  parser: Parser,
): ArrayLikeInfo | undefined {
  if (node.kind === "string") {
    return {
      elementType: "Char",
      length: node.value.length,
      mutable: false,
      isSlice: true,
    };
  }

  if (node.kind === "array-slice") {
    const arrayInfo = getArrayLikeInfo(node.array, parser);
    if (!arrayInfo) {
      return undefined;
    }

    return {
      elementType: arrayInfo.elementType,
      length: node.end - node.start,
      mutable: arrayInfo.mutable,
      isSlice: true,
    };
  }

  if (node.kind !== "variable") {
    return undefined;
  }

  const varInfo = parser.variables.get(node.name);
  if (!varInfo) {
    return undefined;
  }

  const fixedArrayType = parseArrayType(varInfo.type);
  if (fixedArrayType) {
    return {
      elementType: fixedArrayType.elementType,
      length: fixedArrayType.length,
      mutable: varInfo.mutable,
      isSlice: false,
    };
  }

  const sliceReferenceType = parseSliceReferenceType(varInfo.type);
  if (sliceReferenceType) {
    return {
      elementType: sliceReferenceType.elementType,
      length: varInfo.sliceLength,
      mutable: sliceReferenceType.mutable,
      isSlice: true,
    };
  }

  return undefined;
}

function getSliceLengthFromInitializer(
  initializer: ASTNode,
  parser: Parser,
): number | undefined {
  if (
    initializer.kind === "unary-op" &&
    (initializer.operator === "&" || initializer.operator === "&mut")
  ) {
    return getSliceLengthFromInitializer(initializer.operand, parser);
  }

  if (initializer.kind === "string") {
    return initializer.value.length;
  }

  const arrayInfo = getArrayLikeInfo(initializer, parser);
  return arrayInfo?.length;
}

function inferZeroArgCallableReturnType(
  expr: ASTNode,
  parser: Parser,
): Result<string, string> {
  if (expr.kind === "closure") {
    if (expr.parameters.length !== 0) {
      return err("Array generator must be a zero-argument callable");
    }
    return ok(expr.returnType);
  }

  if (expr.kind === "variable") {
    const fnInfo = parser.functions.get(expr.name);
    if (fnInfo) {
      if (fnInfo.parameters.length !== 0) {
        return err("Array generator must be a zero-argument callable");
      }
      return ok(fnInfo.returnType);
    }

    const varResult = getVariable(parser, expr.name);
    if (!varResult.ok) {
      return err(
        "Array generator '" + expr.name + "' is not a function or closure",
      );
    }

    const parsedFunctionType = parseFunctionTypeString(varResult.value.type);
    if (!parsedFunctionType) {
      return err(
        "Array generator '" + expr.name + "' is not a function or closure",
      );
    }
    if (parsedFunctionType.parameterTypes.length !== 0) {
      return err("Array generator must be a zero-argument callable");
    }
    return ok(parsedFunctionType.returnType);
  }

  const exprTypeResult = inferExpressionType(expr, parser);
  if (!exprTypeResult.ok) {
    return err("Array generator must be a function or closure");
  }

  const parsedFunctionType = parseFunctionTypeString(exprTypeResult.value);
  if (!parsedFunctionType) {
    return err("Array generator must be a function or closure");
  }
  if (parsedFunctionType.parameterTypes.length !== 0) {
    return err("Array generator must be a zero-argument callable");
  }
  return ok(parsedFunctionType.returnType);
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

interface AssignmentOperatorInfo {
  isCompound: boolean;
  operator: "+" | "-" | "*" | "/" | "%";
}

// Helper to parse compound assignment operators
function parseCompoundAssignmentOperator(
  parser: Parser,
): Result<AssignmentOperatorInfo, string> {
  const compoundOperators = new Set([
    "PLUS_ASSIGN",
    "MINUS_ASSIGN",
    "MULT_ASSIGN",
    "DIV_ASSIGN",
    "MOD_ASSIGN",
  ]);

  const tok = current(parser);
  if (compoundOperators.has(tok.type)) {
    const operatorMap: Record<string, "+" | "-" | "*" | "/" | "%"> = {
      PLUS_ASSIGN: "+",
      MINUS_ASSIGN: "-",
      MULT_ASSIGN: "*",
      DIV_ASSIGN: "/",
      MOD_ASSIGN: "%",
    };
    const operator = operatorMap[tok.type] || "+";
    advance(parser);
    return ok({ isCompound: true, operator });
  } else if (tok.type === "ASSIGN") {
    advance(parser);
    return ok({ isCompound: false, operator: "+" });
  } else {
    return err("Expected assignment operator");
  }
}

// Helper to check for 'mut' keyword and consume if present
function tryConsumeMutKeyword(parser: Parser): boolean {
  if (
    current(parser).type === "KEYWORD" &&
    (current(parser) as KeywordToken).value === "mut"
  ) {
    advance(parser);
    return true;
  }
  return false;
}

// Helper to try parsing assignment operator and validate format
function tryParseAndValidateAssignmentOperator(
  parser: Parser,
  savedPos: number,
): Result<AssignmentOperatorInfo | undefined, string> {
  const assignOpResult = parseCompoundAssignmentOperator(parser);
  if (!assignOpResult.ok) {
    // Not an assignment, restore position
    parser.pos = savedPos;
    return ok(undefined);
  }
  return ok(assignOpResult.value);
}

function withParsedAssignmentOperator<T>(
  parser: Parser,
  savedPos: number,
  handler: CallableFunction,
): Result<T | undefined, string> {
  const assignOpResult = tryParseAndValidateAssignmentOperator(
    parser,
    savedPos,
  );
  if (!assignOpResult.ok) {
    return assignOpResult;
  }
  if (!assignOpResult.value) {
    return ok(undefined);
  }

  return handler(assignOpResult.value) as Result<T, string>;
}

function parseAssignmentValue(
  parser: Parser,
  isCompound: boolean,
  operator: "+" | "-" | "*" | "/" | "%",
  lvalue: ASTNode,
): Result<ASTNode, string> {
  const valueResult = parseExpression(parser);
  if (!valueResult.ok) {
    return valueResult;
  }

  let assignValue = valueResult.value;

  // For compound assignments, wrap in a binary operation
  if (isCompound) {
    const binaryNode: BinaryNode = {
      kind: "binary",
      left: lvalue,
      operator,
      right: valueResult.value,
    };
    assignValue = binaryNode;
  }

  return ok(assignValue);
}
function handleAssignmentStatement(
  assignResult: Result<ASTNode | undefined, string>,
  parser: Parser,
  statements: ASTNode[],
): Result<boolean, string> {
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
}

function parseBlockResultExpression(
  parser: Parser,
  statements: ASTNode[],
): Result<BlockNode, string> {
  const exprResult = parseExpression(parser);
  if (!exprResult.ok) {
    return exprResult;
  }

  return ok({ kind: "block", statements, result: exprResult.value });
}

function tryParseAssignment(
  parser: Parser,
): Result<ASTNode | undefined, string> {
  const tok = current(parser);

  // Handle dereference assignment: *y = value (or *y += value, etc.)
  if (tok.type === "OPERATOR" && tok.value === "*") {
    const savedPos = parser.pos;

    // Try to parse: parseUnary() then check for assignment operator
    const unaryResult = parseUnary(parser);
    if (!unaryResult.ok) {
      parser.pos = savedPos;
      return ok(undefined);
    }

    return withParsedAssignmentOperator(
      parser,
      savedPos,
      (assignOp: AssignmentOperatorInfo) => {
        const { isCompound, operator } = assignOp;

        // Validate that we're assigning to a dereference
        const lvalue = unaryResult.value;
        if (lvalue.kind !== "unary-op" || lvalue.operator !== "*") {
          parser.pos = savedPos;
          return ok(undefined as never);
        }

        // Validate that the pointer is mutable
        const ptrTypeResult = inferExpressionType(lvalue.operand, parser);
        if (!ptrTypeResult.ok) {
          return ptrTypeResult as Result<never, string>;
        }
        const ptrType = ptrTypeResult.value;
        if (!ptrType.startsWith("*mut ")) {
          return err("Cannot assign through immutable pointer") as Result<
            never,
            string
          >;
        }

        const assignValueResult = parseAssignmentValue(
          parser,
          isCompound,
          operator,
          lvalue,
        );
        if (!assignValueResult.ok) {
          return assignValueResult as Result<never, string>;
        }
        const assignValue = assignValueResult.value;

        // Track which variable the pointer points to (for runtime assignment)
        let targetVar: string | undefined;
        if (lvalue.operand.kind === "variable") {
          const ptrVarName = lvalue.operand.name;
          const ptrVarInfo = parser.variables.get(ptrVarName);
          if (ptrVarInfo && ptrVarInfo.pointsTo) {
            targetVar = ptrVarInfo.pointsTo;
          }
        }

        return ok({
          kind: "deref-assign",
          target: lvalue.operand,
          value: assignValue,
          targetVar,
        } as DerefAssignNode);
      },
    );
  }

  // Try to parse as a postfix expression (could be array access: arr[index])
  // Save position in case it's not an assignment
  const savedPos = parser.pos;

  // Try to parse a postfix expression to check if it's array access or field access
  const postfixResult = parsePostfix(parser);
  if (postfixResult.ok) {
    const lvalue = postfixResult.value;

    // Check if this is array access or field access that could be assigned to
    if (
      (lvalue.kind === "array-access" || lvalue.kind === "field-access") &&
      current(parser).type === "ASSIGN"
    ) {
      advance(parser); // consume ASSIGN

      const valueResult = parseExpression(parser);
      if (!valueResult.ok) {
        return valueResult;
      }

      if (lvalue.kind === "array-access") {
        const arrayInfo = getArrayLikeInfo(lvalue.array, parser);

        // Check that the array or slice is writable
        if (lvalue.array.kind === "variable") {
          const arrayVar = parser.variables.get(lvalue.array.name);
          const sliceReferenceType = arrayVar
            ? parseSliceReferenceType(arrayVar.type)
            : undefined;
          const isWritable = sliceReferenceType
            ? sliceReferenceType.mutable
            : arrayVar?.mutable;

          if (!isWritable) {
            return err(
              "Cannot modify elements of immutable array '" +
                lvalue.array.name +
                "'",
            );
          }
        }

        if (arrayInfo) {
          const elemType = arrayInfo.elementType;
          const arrayLength = arrayInfo.length;

          // Check write bounds against known length.
          const idxNode = lvalue.index;
          if (idxNode.kind === "number" && arrayLength !== undefined) {
            const bareNum = splitNumberLiteral(idxNode.value).numericPart;
            const idxVal = parseFloat(bareNum);
            if (idxVal >= arrayLength) {
              return err(
                "Array write index " +
                  idxVal +
                  " is out of bounds for array of length " +
                  arrayLength +
                  ")",
              );
            }
          }

          // Check assigned value type matches element type
          if (!elemType.startsWith("[")) {
            if (
              valueResult.value.kind === "number" &&
              splitNumberLiteral(valueResult.value.value).numericPart.includes(
                ".",
              )
            ) {
              if (!elemType.startsWith("F")) {
                return err(
                  "Type mismatch in array element assignment: expected " +
                    elemType +
                    " but got float literal",
                );
              }
            }

            const assignedTypeResult = inferExpressionType(
              valueResult.value,
              parser,
            );
            if (assignedTypeResult.ok) {
              const assignedType = assignedTypeResult.value;
              const bothFloat =
                elemType.startsWith("F") && assignedType.startsWith("F");
              const bothInt =
                !elemType.startsWith("F") && !assignedType.startsWith("F");
              if (assignedType !== elemType && !bothFloat && !bothInt) {
                return err(
                  "Type mismatch in array element assignment: expected " +
                    elemType +
                    " but got " +
                    assignedType,
                );
              }
              if (!elemType.startsWith("F") && assignedType.startsWith("F")) {
                return err(
                  "Type mismatch in array element assignment: expected " +
                    elemType +
                    " but got " +
                    assignedType,
                );
              }
            } else if (
              valueResult.value.kind === "number" &&
              valueResult.value.value.includes(".") &&
              !elemType.startsWith("F")
            ) {
              return err(
                "Type mismatch in array element assignment: expected " +
                  elemType +
                  " but got float literal",
              );
            }
          }
        }

        return ok({
          kind: "array-assign",
          array: lvalue.array,
          index: lvalue.index,
          value: valueResult.value,
        } as ArrayAssignNode);
      } else {
        return ok({
          kind: "field-assign",
          object: lvalue.object,
          fieldName: lvalue.fieldName,
          value: valueResult.value,
        } as FieldAssignNode);
      }
    }
  }

  // Restore position and try identifier-based assignment
  parser.pos = savedPos;

  if (tok.type !== "IDENTIFIER") {
    return ok(undefined);
  }

  const name = tok.value;
  advance(parser);

  const nextTok = current(parser);

  // Check if it's a field assignment (object.field(.field...)* = value)
  if (nextTok.type === "DOT") {
    // Collect dot-access chain: ident.a.b.c = value
    // We need to parse all but the last segment as field-access, last as field-assign
    let objNode: ASTNode = { kind: "variable", name };
    advance(parser); // consume first DOT

    const fieldTok = current(parser);
    if (fieldTok.type !== "IDENTIFIER") {
      parser.pos = savedPos;
      return ok(undefined);
    }
    let fieldName = fieldTok.value;
    advance(parser);

    // Consume additional dots (a.b.c = ...)
    while (current(parser).type === "DOT") {
      // The current fieldName becomes an access on objNode
      objNode = {
        kind: "field-access",
        object: objNode,
        fieldName,
      } as FieldAccessNode;
      advance(parser); // consume DOT
      const nextFieldTok = current(parser);
      if (nextFieldTok.type !== "IDENTIFIER") {
        parser.pos = savedPos;
        return ok(undefined);
      }
      fieldName = nextFieldTok.value;
      advance(parser);
    }

    const assignOpTok = current(parser);
    if (assignOpTok.type !== "ASSIGN") {
      parser.pos = savedPos;
      return ok(undefined);
    }
    advance(parser); // consume ASSIGN

    const valueResult = parseExpression(parser);
    if (!valueResult.ok) {
      return valueResult;
    }

    return ok({
      kind: "field-assign",
      object: objNode,
      fieldName,
      value: valueResult.value,
    } as FieldAssignNode);
  }

  return withParsedAssignmentOperator(
    parser,
    savedPos,
    (assignOp: AssignmentOperatorInfo) => {
      const { isCompound, operator } = assignOp;

      const varResult = getVariable(parser, name);
      if (!varResult.ok) {
        return varResult as Result<never, string>;
      }
      if (!varResult.value.mutable) {
        return err(
          "Variable '" + name + "' is immutable and cannot be reassigned",
        ) as Result<never, string>;
      }

      const varLvalue: VariableNode = { kind: "variable", name };
      const assignValueResult = parseAssignmentValue(
        parser,
        isCompound,
        operator,
        varLvalue,
      );
      if (!assignValueResult.ok) {
        return assignValueResult as Result<never, string>;
      }
      const assignValue = assignValueResult.value;

      return ok({
        kind: "assign",
        name,
        value: assignValue,
      });
    },
  );
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
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "fn") {
    // Function declaration
    const fnStmt = parseFunctionStatement(parser);
    if (!fnStmt.ok) {
      return fnStmt;
    }
    statements.push(fnStmt.value);
    return ok(true);
  } else if (
    stmtTok.type === "KEYWORD" &&
    (stmtTok as KeywordToken).value === "struct"
  ) {
    // Struct declaration
    const structStmt = parseStructStatement(parser);
    if (!structStmt.ok) {
      return structStmt;
    }
    statements.push(structStmt.value);
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
  } else if (stmtTok.type === "KEYWORD" && stmtTok.value === "return") {
    // Return statement
    const returnStmt = parseReturnStatement(parser);
    if (!returnStmt.ok) {
      return returnStmt;
    }
    statements.push(returnStmt.value);
    consumeOptionalSemicolon(parser);
    return ok(true);
  } else if (stmtTok.type === "IDENTIFIER") {
    // Could be assignment - use helper
    const assignResult = tryParseAssignment(parser);
    const assignmentHandled = handleAssignmentStatement(
      assignResult,
      parser,
      statements,
    );
    if (!assignmentHandled.ok || assignmentHandled.value) {
      return assignmentHandled;
    }

    const savedPos = parser.pos;
    const exprResult = parseExpression(parser);
    if (!exprResult.ok) {
      parser.pos = savedPos;
      return ok(false);
    }
    if (
      exprResult.value.kind === "function-call" &&
      current(parser).type === "SEMICOLON"
    ) {
      statements.push(exprResult.value);
      consumeOptionalSemicolon(parser);
      return ok(true);
    }

    parser.pos = savedPos;
    return ok(false);
  } else if (stmtTok.type === "OPERATOR" && stmtTok.value === "*") {
    // Could be dereference assignment: *y = value
    const assignResult = tryParseAssignment(parser);
    return handleAssignmentStatement(assignResult, parser, statements);
  } else {
    return ok(false);
  }
}

function isBooleanNode(node: ASTNode): boolean {
  return (
    node.kind === "boolean" ||
    node.kind === "comparison" ||
    node.kind === "logical" ||
    node.kind === "unary-logical"
  );
}

function validateBooleanCondition(
  node: ASTNode,
  parser?: Parser,
): Result<undefined, string> {
  // Allow boolean literals directly
  if (node.kind === "boolean") {
    return ok(undefined);
  }

  // Allow integer literals 1/0 as boolean (truthy/falsy constants)
  if (node.kind === "number") {
    const numericPart = splitNumberLiteral(node.value).numericPart;
    const numStr = numericPart.startsWith("-")
      ? numericPart.slice(1)
      : numericPart;
    // Must be 0 or 1 (without type suffix)
    if (numStr === "0" || numStr === "1") {
      return ok(undefined);
    }
    return err("Condition must be a boolean expression");
  }

  // Allow variable references only if they have Bool type
  if (node.kind === "variable") {
    if (parser) {
      const varInfo = parser.variables.get(node.name);
      if (varInfo && varInfo.type !== "Bool") {
        return err("Condition must be a boolean expression");
      }
    }
    return ok(undefined);
  }

  if (
    node.kind === "function-call" ||
    node.kind === "if" ||
    node.kind === "match"
  ) {
    return ok(undefined);
  }

  if (!isBooleanNode(node)) {
    return err("Condition must be a boolean expression");
  }

  return ok(undefined);
}

/**
 * Parses a condition expression, with optional surrounding parentheses.
 * If the next token is '(', parens are consumed; otherwise the expression
 * is parsed directly. The condition is validated as a boolean expression.
 */
function parseConditionExpression(parser: Parser): Result<ASTNode, string> {
  const hasParen = current(parser).type === "LPAREN";

  if (hasParen) {
    advance(parser); // consume '('
  }

  const conditionResult = parseExpression(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  if (hasParen) {
    if (current(parser).type !== "RPAREN") {
      return err("Expected ')'");
    }
    advance(parser); // consume ')'
  }

  const boolCheck = validateBooleanCondition(conditionResult.value, parser);
  if (!boolCheck.ok) {
    return boolCheck;
  }

  return conditionResult;
}

function parseBlockStatements(parser: Parser): Result<ASTNode[], string> {
  const stmtsResult = parseBlockStatementsInternal(parser);
  if (!stmtsResult.ok) {
    return stmtsResult;
  }

  // Expect '}'
  if (current(parser).type !== "RBRACE") {
    return err("Expected '}'");
  }
  advance(parser);

  return stmtsResult;
}

// Internal helper to parse block statements without consuming RBRACE (for if/else with final expressions)
function parseBlockStatementsWithoutRbrace(
  parser: Parser,
): Result<ASTNode[], string> {
  return parseBlockStatementsInternal(parser);
}

// Shared internal implementation for parsing block statements
function parseBlockStatementsInternal(
  parser: Parser,
): Result<ASTNode[], string> {
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

  return ok(statements);
}

// Helper: extract the last if/match as result if it exists
function extractFinalExpressionIfPresent(
  statements: ASTNode[],
): ASTNode | undefined {
  if (statements.length === 0) {
    return undefined;
  }

  const lastStmt = statements[statements.length - 1];
  if (
    lastStmt &&
    (lastStmt.kind === "match" ||
      (lastStmt.kind === "if" && lastStmt.elseBranch !== undefined))
  ) {
    return lastStmt;
  }

  return undefined;
}

function createBlockBodyWithOptionalExpression(
  statements: ASTNode[],
  parser: Parser,
): Result<ASTNode, string> {
  const resultTok = current(parser);

  // Check if at end of block
  if (resultTok.type === "RBRACE" || resultTok.type === "EOF") {
    const finalExpr = extractFinalExpressionIfPresent(statements);
    if (finalExpr) {
      statements.pop();
      return ok({
        kind: "block",
        statements,
        result: finalExpr,
      });
    }
    return ok({
      kind: "block",
      statements,
      result: { kind: "number", value: "0" },
    });
  }

  // Check if it's a non-expression keyword
  const nonExprKeywords = new Set([
    "let",
    "fn",
    "struct",
    "while",
    "break",
    "continue",
    "return",
  ]);

  if (resultTok.type === "KEYWORD" && nonExprKeywords.has(resultTok.value)) {
    return ok({
      kind: "block",
      statements,
      result: { kind: "number", value: "0" },
    });
  }

  // For IDENTIFIER, check if it's followed by assignment or is a bare variable ref
  if (resultTok.type === "IDENTIFIER") {
    const nextIdx = parser.pos + 1;
    const nextTok =
      nextIdx < parser.tokens.length ? parser.tokens[nextIdx] : undefined;

    const assignmentOps = new Set([
      "ASSIGN",
      "PLUS_ASSIGN",
      "MINUS_ASSIGN",
      "MULT_ASSIGN",
      "DIV_ASSIGN",
      "MOD_ASSIGN",
    ]);

    // If it's an assignment, no final expression
    if (nextTok && assignmentOps.has(nextTok.type)) {
      return ok({
        kind: "block",
        statements,
        result: { kind: "number", value: "0" },
      });
    }

    // If followed by '[' or '.', parse full postfix expression (e.g. arr[0] or obj.field)
    if (nextTok && (nextTok.type === "LBRACKET" || nextTok.type === "DOT")) {
      return parseBlockResultExpression(parser, statements);
    }

    // It's a variable reference - parse it as primary (just the identifier)
    const varName = resultTok.value;
    advance(parser);

    // Check if variable exists
    const varResult = getVariable(parser, varName);
    if (!varResult.ok) {
      return varResult;
    }

    return ok({
      kind: "block",
      statements,
      result: { kind: "variable", name: varName },
    });
  }

  // Try to parse other expression types (NUMBER, BOOL, LPAREN, if, match)
  if (
    resultTok.type === "NUMBER" ||
    resultTok.type === "BOOL" ||
    resultTok.type === "CHAR" ||
    resultTok.type === "STRING" ||
    resultTok.type === "LPAREN" ||
    (resultTok.type === "KEYWORD" &&
      (resultTok.value === "if" || resultTok.value === "match"))
  ) {
    return parseBlockResultExpression(parser, statements);
  }

  // Default: no final expression
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

  // Parse condition (parentheses optional)
  const conditionResult = parseConditionExpression(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  // Save current proven constraints for scope management
  const savedConstraints = new Map(parser.provenConstraints);

  // Extract constraints from the condition for type narrowing in then-branch
  const thenConstraints = extractConstraintsFromComparison(
    conditionResult.value,
    parser,
  );
  // Add constraints to parser context for then-branch
  // MERGE with existing constraints to handle nesting (don't overwrite!)
  for (const [varName, refinement] of thenConstraints) {
    const existing = parser.provenConstraints.get(varName);
    if (existing && existing.baseType === refinement.baseType) {
      // Merge: combine all constraints from outer scope + new from condition
      existing.constraints.push(...refinement.constraints);
    } else {
      parser.provenConstraints.set(varName, refinement);
    }
  }

  // Parse then branch (single statement or block)
  const thenResult = parseIfBody(parser);
  if (!thenResult.ok) {
    // Restore constraints even on error
    parser.provenConstraints = savedConstraints;
    return thenResult;
  }

  // Restore to saved constraints for else branch (proven constraints are lost outside narrowing)
  parser.provenConstraints = new Map(savedConstraints);

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

  // Restore original constraints after if statement
  parser.provenConstraints = savedConstraints;

  return ok({
    kind: "if",
    condition: conditionResult.value,
    thenBranch: thenResult.value,
    elseBranch,
  });
}

function parseIfBody(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  // Block body - use helper that doesn't consume RBRACE so we can parse final expression
  if (tok.type === "LBRACE") {
    const stmtsResult = parseBlockStatementsWithoutRbrace(parser);
    if (!stmtsResult.ok) {
      return stmtsResult;
    }

    const blockResult = createBlockBodyWithOptionalExpression(
      stmtsResult.value,
      parser,
    );
    if (!blockResult.ok) {
      return blockResult;
    }

    // Now consume the closing RBRACE
    if (current(parser).type !== "RBRACE") {
      return err("Expected '}'");
    }
    advance(parser);

    return blockResult;
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

  // Parse condition (parentheses optional)
  const conditionResult = parseConditionExpression(parser);
  if (!conditionResult.ok) {
    return conditionResult;
  }

  // Parse body (single statement or block)
  const savedInLoop = parser.inLoop;
  parser.inLoop = true;
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
    parser.inLoop = savedInLoop;
    return bodyResult;
  }

  parser.inLoop = savedInLoop;

  return ok({
    kind: "while",
    condition: conditionResult.value,
    body: bodyResult.value,
  });
}

function parseBreakStatement(parser: Parser): Result<ASTNode, string> {
  const breakTok = current(parser);
  if (breakTok.type !== "KEYWORD" || breakTok.value !== "break") {
    return err("Expected 'break'");
  }
  if (!parser.inLoop) {
    return err("'break' is only valid inside a loop");
  }
  advance(parser);

  return ok({ kind: "break" });
}

function parseContinueStatement(parser: Parser): Result<ASTNode, string> {
  const continueTok = current(parser);
  if (continueTok.type !== "KEYWORD" || continueTok.value !== "continue") {
    return err("Expected 'continue'");
  }
  if (!parser.inLoop) {
    return err("'continue' is only valid inside a loop");
  }
  advance(parser);

  return ok({ kind: "continue" });
}

function parseReturnStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'return'
  const returnTok = current(parser);
  if (returnTok.type !== "KEYWORD" || returnTok.value !== "return") {
    return err("Expected 'return'");
  }
  advance(parser);

  // Parse return value expression
  const valueResult = parseExpression(parser);
  if (!valueResult.ok) {
    return valueResult;
  }

  return ok({
    kind: "return",
    value: valueResult.value,
  });
}

function parseMatchExpression(parser: Parser): Result<ASTNode, string> {
  // Expect 'match'
  const matchTok = current(parser);
  if (matchTok.type !== "KEYWORD" || matchTok.value !== "match") {
    return err("Expected 'match'");
  }
  advance(parser);

  // Expect '('
  const lparen = current(parser);
  if (lparen.type !== "LPAREN") {
    return err("Expected '(' after 'match'");
  }
  advance(parser);

  // Parse match expression
  const exprResult = parseExpression(parser);
  if (!exprResult.ok) {
    return exprResult;
  }

  // Expect ')'
  const rparen = current(parser);
  if (rparen.type !== "RPAREN") {
    return err("Expected ')' after match expression");
  }
  advance(parser);

  // Expect '{'
  const lbrace = current(parser);
  if (lbrace.type !== "LBRACE") {
    return err("Expected '{' before match cases");
  }
  advance(parser);

  // Parse cases
  const cases: MatchCase[] = [];
  const patternsUsed = new Set<string>();

  while (current(parser).type !== "RBRACE" && current(parser).type !== "EOF") {
    // Expect 'case'
    const caseTok = current(parser);
    if (caseTok.type !== "KEYWORD" || caseTok.value !== "case") {
      return err("Expected 'case' in match expression");
    }
    advance(parser);

    // Parse pattern
    const patternResult = parseMatchPattern(parser);
    if (!patternResult.ok) {
      return patternResult;
    }

    const pattern = patternResult.value;

    // Check for duplicate patterns
    const patternKey = pattern.type + ":" + String(pattern.value);
    if (patternsUsed.has(patternKey)) {
      return err(
        "Duplicate case pattern: " +
          (pattern.type === "wildcard" ? "_" : pattern.value),
      );
    }
    patternsUsed.add(patternKey);

    // Expect '=>'
    const arrow = current(parser);
    if (arrow.type !== "ARROW") {
      return err("Expected '=>' after match pattern");
    }
    advance(parser);

    // Parse case result expression
    const resultExpr = parseExpression(parser);
    if (!resultExpr.ok) {
      return resultExpr;
    }

    // Expect ';'
    const semi = current(parser);
    if (semi.type !== "SEMICOLON") {
      return err("Expected ';' after match case");
    }
    advance(parser);

    cases.push({
      pattern,
      result: resultExpr.value,
    });
  }

  // Expect '}'
  if (current(parser).type !== "RBRACE") {
    return err("Expected '}' after match cases");
  }
  advance(parser);

  // Validate: must have either wildcard or exhaustive coverage
  const hasWildcard = cases.some((c) => c.pattern.type === "wildcard");

  if (!hasWildcard) {
    // Check if coverage is exhaustive for booleans (true and false both present)
    const booleanCases = cases.filter((c) => c.pattern.type === "boolean");
    const hasTrue = booleanCases.some((c) => c.pattern.value === true);
    const hasFalse = booleanCases.some((c) => c.pattern.value === false);
    const allCasesAreBoolean = cases.every((c) => c.pattern.type === "boolean");

    if (!(allCasesAreBoolean && hasTrue && hasFalse)) {
      return err(
        "Match expression must have a wildcard case or be exhaustive (for booleans, need both true and false cases)",
      );
    }
  }

  return ok({
    kind: "match",
    matchExpr: exprResult.value,
    cases,
  });
}

function parseMatchPattern(parser: Parser): Result<CasePattern, string> {
  const tok = current(parser);

  // Check for wildcard
  if (tok.type === "IDENTIFIER" && tok.value === "_") {
    advance(parser);
    return ok({ type: "wildcard" });
  }

  // Check for boolean
  if (tok.type === "BOOL") {
    const value = tok.value === "true";
    advance(parser);
    return ok({ type: "boolean", value });
  }

  // Check for number (including negative)
  if (tok.type === "NUMBER") {
    const value = tok.value;
    advance(parser);
    return ok({ type: "literal", value });
  }

  return err("Expected pattern (number, boolean, or wildcard) in match case");
}

function parseProgram(parser: Parser): Result<ASTNode, string> {
  const statements: ASTNode[] = [];

  // Parse all let and assignment statements and if statements
  const blockResult = parseStatementBlock(parser, statements, false);
  if (!blockResult.ok) {
    return blockResult;
  }

  // Check if we're at EOF before trying to parse a final expression
  if (current(parser).type === "EOF") {
    // If we have statements, use the last expression-like statement as the result
    if (statements.length > 0) {
      const finalExpr = extractFinalExpressionIfPresent(statements);
      if (finalExpr) {
        // Use this as the result, remove it from statements
        statements.pop();
        if (statements.length === 0) {
          return ok(finalExpr);
        }
        return ok({ kind: "block", statements, result: finalExpr });
      }
      // Otherwise, return a block with the statements and a default result
      return ok({
        kind: "block",
        statements,
        result: { kind: "number", value: "0" },
      });
    }
    // If no statements and EOF, return 0
    return ok({ kind: "number", value: "0" });
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
    return err("Variable '" + name + "' already declared");
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

  if (parseSliceType(typeStr) && !parseArrayType(typeStr)) {
    return err(
      "Slice value types must be referenced as *[T] or *mut [T] in let bindings",
    );
  }

  // Try to parse refinement constraints
  let refinement: RefinementType | undefined;
  const refinementResult = parseRefinementType(parser, typeStr);
  if (!refinementResult.ok) {
    return refinementResult;
  }
  refinement = refinementResult.value;

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

  // Type check for array types: validate fixed-length initialization
  if (typeStr.startsWith("[")) {
    const parsedArrayType = parseArrayType(typeStr);
    if (parsedArrayType) {
      const { elementType, length } = parsedArrayType;

      if (length <= 0) {
        return err("Array length must be > 0");
      }

      if (
        initializer.kind !== "array-literal" &&
        initializer.kind !== "function-call" &&
        initializer.kind !== "variable"
      ) {
        return err("Expected array literal for array type");
      }

      if (initializer.kind !== "array-literal") {
        const matchTypeResult = ensureExpressionType(
          parser,
          initializer,
          typeStr,
        );
        if (!matchTypeResult.ok) {
          return matchTypeResult;
        }
      } else {
        const arrayLit = initializer as ArrayLiteralNode;
        const elemType = elementType;

        if (arrayLit.generator) {
          if (arrayLit.repeatCount !== length) {
            return err(
              "Array generator repeats " +
                (arrayLit.repeatCount ?? 0) +
                " times but type specifies length " +
                length,
            );
          }

          const generatorTypeResult = inferZeroArgCallableReturnType(
            arrayLit.generator,
            parser,
          );
          if (!generatorTypeResult.ok) {
            return generatorTypeResult;
          }

          if (generatorTypeResult.value !== elemType) {
            const bothFloat =
              elemType.startsWith("F") &&
              generatorTypeResult.value.startsWith("F");
            const bothInt =
              !elemType.startsWith("F") &&
              !elemType.startsWith("Bool") &&
              !generatorTypeResult.value.startsWith("F") &&
              generatorTypeResult.value !== "Bool";
            if (!bothFloat && !bothInt) {
              return err(
                "Type mismatch in array generator: expected " +
                  elemType +
                  " but got " +
                  generatorTypeResult.value,
              );
            }
          }
        } else {
          if (arrayLit.elements.length !== length) {
            return err(
              "Array initializer has " +
                arrayLit.elements.length +
                " elements but type specifies " +
                length,
            );
          }

          // Type-check each element against the declared element type
          if (elemType && !elemType.startsWith("[")) {
            for (let idx = 0; idx < arrayLit.elements.length; idx++) {
              const elemNode = arrayLit.elements[idx];
              if (elemNode && elemNode.kind === "number") {
                // Check element type annotation if present
                const numVal = elemNode.value;
                let numTypeAnnotation = "";
                for (let ci = numVal.length - 1; ci >= 0; ci--) {
                  if (isLetter(numVal[ci]) || numVal[ci] === "_") {
                    numTypeAnnotation = numVal[ci] + numTypeAnnotation;
                  } else {
                    break;
                  }
                }
                // Check float assigned to integer type
                const isFloatType = elemType.startsWith("F");
                const isIntType = !isFloatType && !elemType.startsWith("Bool");
                if (isIntType && numVal.includes(".")) {
                  return err(
                    "Type mismatch in array element " +
                      idx +
                      ": expected " +
                      elemType +
                      " but got float literal",
                  );
                }
                if (numTypeAnnotation && numTypeAnnotation !== elemType) {
                  return err(
                    "Type mismatch in array element " +
                      idx +
                      ": expected " +
                      elemType +
                      " but got " +
                      numTypeAnnotation,
                  );
                }
              } else {
                const elemTypeResult = inferExpressionType(elemNode!, parser);
                if (elemTypeResult.ok && elemTypeResult.value !== elemType) {
                  // Check for type mismatch (allow widening from same family)
                  const bothFloat =
                    elemType.startsWith("F") &&
                    elemTypeResult.value.startsWith("F");
                  const bothInt =
                    !elemType.startsWith("F") &&
                    !elemTypeResult.value.startsWith("F");
                  if (!bothFloat && !bothInt) {
                    return err(
                      "Type mismatch in array element " +
                        idx +
                        ": expected " +
                        elemType +
                        " but got " +
                        elemTypeResult.value,
                    );
                  }
                }
              }
            }
          }
        }

        arrayLit.elemType = elemType;
      } // close else (array-literal branch)
    }
  } else if (parseFunctionTypeString(typeStr)) {
    const matchTypeResult = ensureExpressionType(parser, initializer, typeStr);
    if (!matchTypeResult.ok) {
      return matchTypeResult;
    }
  } else if (initializer.kind === "array-literal") {
    return err("Array literal used with non-array type '" + typeStr + "'");
  }

  // Type check for pointer types: must infer expression type for correct pointer assignment
  if (typeStr.startsWith("*")) {
    const exprTypeResult = inferExpressionType(initializer, parser);
    if (!exprTypeResult.ok) {
      return exprTypeResult;
    }
    const exprType = exprTypeResult.value;

    // Check that expression type matches declared type, with coercion support
    // Allow *mut T to coerce to *T
    let isCompatible = exprType === typeStr;
    if (
      !isCompatible &&
      exprType.startsWith("*mut ") &&
      typeStr.startsWith("*")
    ) {
      // Strip "*mut " from exprType and "*" from typeStr and compare base types
      const exprBase = exprType.slice(5); // Remove "*mut "
      const typeBase = typeStr.slice(1); // Remove one "*"
      isCompatible = exprBase === typeBase;
    }
    if (!isCompatible) {
      return err(
        "Type mismatch: expression has type '" +
          exprType +
          "' but variable declared as '" +
          typeStr +
          "'",
      );
    }
  }

  if (typeStr === "Char" || initializer.kind === "char") {
    const exprTypeResult = inferExpressionType(initializer, parser);
    if (!exprTypeResult.ok) {
      return exprTypeResult;
    }
    if (!areTypesCompatible(typeStr, exprTypeResult.value)) {
      return err(
        "Type mismatch: expression has type '" +
          exprTypeResult.value +
          "' but variable declared as '" +
          typeStr +
          "'",
      );
    }
  }

  if (initializer.kind === "number") {
    // Check if negative literal is assigned to unsigned type
    if (
      initializer.value.startsWith("-") &&
      !typeStr.startsWith("I") &&
      !typeStr.startsWith("F") &&
      !typeStr.startsWith("*")
    ) {
      return err(
        "Cannot assign negative value to unsigned type '" + typeStr + "'",
      );
    }

    // If there's a refinement type, validate the literal against constraints
    if (refinement) {
      if (
        !validateConstraints(
          initializer.value,
          refinement,
          parser.variables,
          parser,
        )
      ) {
        return err(
          "Literal value does not satisfy refinement constraints for type",
        );
      }
    }
  } else if (initializer.kind === "variable" && refinement) {
    // Assigning a variable to a refined type - check if we can prove the constraint
    const sourceVarName = initializer.name;
    if (!canAssignToRefinedType(sourceVarName, refinement, parser)) {
      return err(
        "Cannot assign variable '" +
          sourceVarName +
          "' to refined type - constraint cannot be proven",
      );
    }
  }

  // Expect ';'
  const semiTok = current(parser);
  if (semiTok.type !== "SEMICOLON") {
    return err("Expected ';' after let statement");
  }
  advance(parser);

  // Register variable in parser context with refinement info
  // Store initValue if it's a numeric literal (so we can constant-fold constraints)
  const varInfo: VariableInfo = { type: typeStr, mutable, refinement };
  if (initializer.kind === "number") {
    varInfo.initValue = initializer.value;
  }

  const sliceReferenceType = parseSliceReferenceType(typeStr);
  if (sliceReferenceType) {
    varInfo.sliceLength = getSliceLengthFromInitializer(initializer, parser);
  }

  // Track what variable a pointer points to (for lvalue operations)
  // Also enforce exclusive access for mutable pointers
  if (
    typeStr.startsWith("*") &&
    initializer.kind === "unary-op" &&
    (initializer.operator === "&" || initializer.operator === "&mut")
  ) {
    const targetVar = initializer.operand;
    if (targetVar.kind === "variable") {
      varInfo.pointsTo = targetVar.name;

      // Enforce exclusive access: only one &mut per variable
      if (initializer.operator === "&mut") {
        // Check if another variable already has a mutable pointer to this target
        for (const [, otherInfo] of parser.variables.entries()) {
          if (
            otherInfo.pointsTo === targetVar.name &&
            otherInfo.type.startsWith("*mut ") &&
            !parseSliceReferenceType(otherInfo.type)
          ) {
            return err(
              `Cannot create multiple mutable pointers to '${targetVar.name}' - exclusive access violation`,
            );
          }
        }
      }
    }
  }

  // If initialized with another pointer, inherit its pointsTo
  if (typeStr.startsWith("*") && initializer.kind === "variable") {
    const sourceVarInfo = parser.variables.get(initializer.name);
    if (sourceVarInfo && sourceVarInfo.pointsTo) {
      varInfo.pointsTo = sourceVarInfo.pointsTo;
    }
  }

  parser.variables.set(name, varInfo);

  // Record proven constraints for this variable
  // If initialized with a literal that satisfies the constraints, the constraint is proven
  if (refinement && initializer.kind === "number") {
    parser.provenConstraints.set(name, refinement);
  }
  // If initialized with a variable, inherit its proven constraints
  else if (initializer.kind === "variable") {
    const sourceVarName = initializer.name;
    const sourceProven = parser.provenConstraints.get(sourceVarName);
    if (sourceProven) {
      parser.provenConstraints.set(name, sourceProven);
    }
  }

  return ok({
    kind: "let",
    mutable,
    name,
    type: typeStr,
    initializer,
  });
}

function isReservedKeyword(name: string): boolean {
  return (
    name === "let" ||
    name === "mut" ||
    name === "if" ||
    name === "else" ||
    name === "while" ||
    name === "break" ||
    name === "continue" ||
    name === "match" ||
    name === "case" ||
    name === "fn" ||
    name === "return"
  );
}

function checkReservedKeyword(
  name: string,
  context: "function name" | "parameter name",
): Result<undefined, string> {
  if (isReservedKeyword(name)) {
    return err("Cannot use reserved keyword '" + name + "' as " + context);
  }
  return ok(undefined);
}

function parseFunctionStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'fn'
  const fnTok = current(parser);
  if (fnTok.type !== "KEYWORD" || fnTok.value !== "fn") {
    return err("Expected 'fn'");
  }
  advance(parser);

  // Expect function name
  const nameTok = current(parser);
  if (nameTok.type !== "IDENTIFIER") {
    return err("Expected function name");
  }
  const functionName = nameTok.value;

  // Check reserved keyword
  const fnNameCheck = checkReservedKeyword(functionName, "function name");
  if (!fnNameCheck.ok) {
    return fnNameCheck;
  }

  advance(parser);

  // Expect '('
  const lparenTok = current(parser);
  if (lparenTok.type !== "LPAREN") {
    return err("Expected '(' after function name");
  }
  advance(parser);

  const parametersResult = parseFunctionParameters(parser, true);
  if (!parametersResult.ok) {
    return parametersResult;
  }
  const parameters = parametersResult.value;

  // Expect ':'
  const returnColonTok = current(parser);
  if (returnColonTok.type !== "COLON") {
    return err("Expected ':' before return type");
  }
  advance(parser);

  // Parse return type
  const returnTypeResult = parseTypeValue(parser);
  if (!returnTypeResult.ok) {
    return returnTypeResult;
  }
  const returnType = returnTypeResult.value;
  advance(parser);

  // Expect '=>'
  const arrowTok = current(parser);
  if (arrowTok.type !== "ARROW") {
    return err("Expected '=>' after return type");
  }
  advance(parser);

  // Register function in parser context BEFORE parsing body
  // This allows recursive calls to find the function
  parser.functions.set(functionName, {
    parameters,
    returnType,
  });

  // Parse function body
  // Save current variable scope and loop context
  const savedVariables = new Map(parser.variables);
  const savedInLoop = parser.inLoop;
  parser.inLoop = false;

  // Add parameters to scope
  for (const param of parameters) {
    parser.variables.set(param.name, { type: param.type, mutable: false });
  }

  const bodyTok = current(parser);
  let body: ASTNode;

  if (bodyTok.type === "LBRACE") {
    // Block body with statements - handle manually to support implicit return
    advance(parser); // consume LBRACE

    const statements: ASTNode[] = [];
    const blockResult = parseStatementBlock(parser, statements);
    if (!blockResult.ok) {
      parser.variables = savedVariables;
      parser.inLoop = savedInLoop;
      return blockResult;
    }

    // Try to parse a final expression (required when return type is not Void)
    let result: ASTNode = { kind: "number", value: "0" };

    const exprTok = current(parser);
    if (exprTok.type !== "RBRACE") {
      const exprResult = parseExpression(parser);
      if (exprResult.ok) {
        result = exprResult.value;
      } else {
        if (current(parser).type !== "RBRACE") {
          parser.variables = savedVariables;
          parser.inLoop = savedInLoop;
          return exprResult;
        }
      }
    } else if (returnType !== "Void") {
      // No final expression — acceptable only if last statement is a return
      const lastStmt =
        statements.length > 0 ? statements[statements.length - 1] : undefined;
      if (!lastStmt || lastStmt.kind !== "return") {
        parser.variables = savedVariables;
        parser.inLoop = savedInLoop;
        return err(
          "Function body must end with an expression when return type is not Void",
        );
      }
    }

    // Expect closing brace
    if (current(parser).type !== "RBRACE") {
      parser.variables = savedVariables;
      parser.inLoop = savedInLoop;
      return err("Expected '}'");
    }
    advance(parser);

    body = {
      kind: "block",
      statements,
      result,
    };
  } else {
    // Arrow body
    const assignResult = tryParseAssignment(parser);
    if (!assignResult.ok) {
      parser.variables = savedVariables;
      parser.inLoop = savedInLoop;
      return assignResult;
    }

    if (assignResult.value !== undefined) {
      if (returnType !== "Void") {
        parser.variables = savedVariables;
        parser.inLoop = savedInLoop;
        return err(
          "Function with non-Void return type must have an expression body",
        );
      }
      body = assignResult.value;
    } else {
      if (returnType === "Void") {
        parser.variables = savedVariables;
        parser.inLoop = savedInLoop;
        return err(
          "Function with Void return type cannot have an expression body",
        );
      }

      const exprResult = parseExpression(parser);
      if (!exprResult.ok) {
        parser.variables = savedVariables;
        parser.inLoop = savedInLoop;
        return exprResult;
      }

      body = exprResult.value;
    }

    // Expect ';' after expression
    const semiTok = current(parser);
    if (semiTok.type !== "SEMICOLON") {
      parser.variables = savedVariables;
      parser.inLoop = savedInLoop;
      return err("Expected ';' after function arrow expression");
    }
    advance(parser);
  }

  // Restore variable scope and loop context
  parser.variables = savedVariables;
  parser.inLoop = savedInLoop;

  return ok({
    kind: "function",
    name: functionName,
    parameters,
    returnType,
    body,
  });
}

function tryParseClosureLiteral(
  parser: Parser,
): Result<ClosureNode | undefined, string> {
  const savedPos = parser.pos;
  if (current(parser).type !== "LPAREN") {
    return ok(undefined);
  }
  advance(parser);

  if (!canStartClosureParameterList(parser)) {
    parser.pos = savedPos;
    return ok(undefined);
  }

  const parametersResult = parseFunctionParameters(parser, true);
  if (!parametersResult.ok) {
    return parametersResult;
  }
  const parameters = parametersResult.value;

  if (current(parser).type !== "ARROW") {
    parser.pos = savedPos;
    return ok(undefined);
  }
  advance(parser);

  const savedVariables = new Map(parser.variables);
  for (const param of parameters) {
    parser.variables.set(param.name, { type: param.type, mutable: false });
  }

  let body: ASTNode;
  const assignResult = tryParseAssignment(parser);
  if (!assignResult.ok) {
    parser.variables = savedVariables;
    return assignResult;
  }

  if (assignResult.value !== undefined) {
    body = assignResult.value;
  } else {
    const exprResult = parseExpression(parser);
    if (!exprResult.ok) {
      parser.variables = savedVariables;
      return exprResult;
    }
    body = exprResult.value;
  }

  const returnTypeResult = inferExpressionType(body, parser);
  const returnType =
    returnTypeResult.ok &&
    body.kind !== "assign" &&
    body.kind !== "field-assign" &&
    body.kind !== "array-assign" &&
    body.kind !== "deref-assign"
      ? returnTypeResult.value
      : "Void";

  parser.variables = savedVariables;
  return ok({
    kind: "closure",
    parameters,
    returnType,
    body,
  });
}

/**
 * Parses struct field list from `{` to `}` (inclusive).
 * Returns the parsed fields or an error.
 */
function parseStructFieldList(parser: Parser): Result<StructField[], string> {
  // Expect '{'
  if (current(parser).type !== "LBRACE") {
    return err("Expected '{' after struct name");
  }
  advance(parser);

  const fields: StructField[] = [];
  const fieldNames = new Set<string>();

  while (current(parser).type !== "RBRACE") {
    // Check for mut modifier
    let mutable = false;
    const tok = current(parser);
    if (tok.type === "KEYWORD") {
      const keywordTok = tok as KeywordToken;
      if (keywordTok.value === "mut") {
        mutable = true;
        advance(parser);
      }
    }

    // Get field name
    if (current(parser).type !== "IDENTIFIER") {
      return err("Expected field name");
    }
    const fieldNameTok = current(parser) as IdentifierToken;
    const fieldName = fieldNameTok.value;
    advance(parser);

    // Reject duplicate field names
    const prevSize = fieldNames.size;
    fieldNames.add(fieldName);
    if (fieldNames.size === prevSize) {
      return err("Duplicate field name '" + fieldName + "'");
    }

    // Expect ':'
    if (current(parser).type !== "COLON") {
      return err("Expected ':' after field name");
    }
    advance(parser);

    // Parse field type
    const fieldTypeResult = parseTypeValue(parser);
    if (!fieldTypeResult.ok) {
      return fieldTypeResult;
    }
    const fieldType = fieldTypeResult.value;
    advance(parser);

    fields.push({ name: fieldName, type: fieldType, mutable });

    // Expect ';'
    if (current(parser).type !== "SEMICOLON") {
      return err("Expected ';' after field");
    }
    advance(parser);
  }

  if (current(parser).type !== "RBRACE") {
    return err("Expected '}' after struct fields");
  }
  advance(parser); // consume '}'

  return ok(fields);
}

function parseStructStatement(parser: Parser): Result<ASTNode, string> {
  // Expect 'struct'
  const structTok = current(parser);
  if (
    structTok.type !== "KEYWORD" ||
    (structTok as KeywordToken).value !== "struct"
  ) {
    return err("Expected 'struct'");
  }
  advance(parser);

  // Expect struct name
  const nameTok = current(parser);
  if (nameTok.type !== "IDENTIFIER") {
    return err("Expected struct name");
  }
  const structName = (nameTok as IdentifierToken).value;
  advance(parser);

  const fieldsResult = parseStructFieldList(parser);
  if (!fieldsResult.ok) {
    return fieldsResult;
  }

  return ok({
    kind: "struct",
    name: structName,
    fields: fieldsResult.value,
  });
}

function parseExpression(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  // Check for if expression
  if (tok.type === "KEYWORD" && tok.value === "if") {
    return parseIfStatement(parser);
  }

  // Check for match expression
  if (tok.type === "KEYWORD" && tok.value === "match") {
    return parseMatchExpression(parser);
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
  castType: "+" | "-" | "*" | "/" | "%",
): Result<ASTNode, string> {
  const result = parseBinary(parser, {
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

  // Validate that neither operand has pointer type (no pointer arithmetic)
  if (result.ok && result.value.kind === "binary") {
    const leftType = inferExpressionType(result.value.left, parser);
    const rightType = inferExpressionType(result.value.right, parser);

    if (leftType.ok && leftType.value.startsWith("*")) {
      return err("Cannot use pointer in arithmetic operation");
    }
    if (rightType.ok && rightType.value.startsWith("*")) {
      return err("Cannot use pointer in arithmetic operation");
    }
  }

  return result;
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
    parseUnary,
    new Set(["*", "/", "%"]),
    "*" as "*" | "/" | "%",
  );
}

function parseUnary(parser: Parser): Result<ASTNode, string> {
  const tok = current(parser);

  // Handle unary prefix operators: * (dereference) and & (address-of)
  if (tok.type === "OPERATOR" && tok.value === "*") {
    advance(parser);
    const operandResult = parseUnary(parser); // Right-associative: **a means *(*a)
    if (!operandResult.ok) {
      return operandResult;
    }

    // Validate that we're dereferencing a pointer type
    const operandTypeResult = inferExpressionType(operandResult.value, parser);
    if (operandTypeResult.ok && !operandTypeResult.value.startsWith("*")) {
      return err(
        "Cannot dereference non-pointer type: " + operandTypeResult.value,
      );
    }

    return ok({
      kind: "unary-op",
      operator: "*",
      operand: operandResult.value,
    } as UnaryOpNode);
  }

  if (tok.type === "ADDRESS_OF") {
    advance(parser);

    // Check for 'mut' keyword after &
    const isMutable = tryConsumeMutKeyword(parser);

    const operandResult = parseUnary(parser); // Right-associative: &&a means &(&a)
    if (!operandResult.ok) {
      return operandResult;
    }

    let operandNode = operandResult.value;
    if (operandNode.kind === "variable") {
      const arrayInfo = getArrayLikeInfo(operandNode, parser);
      if (arrayInfo && !arrayInfo.isSlice && arrayInfo.length !== undefined) {
        operandNode = {
          kind: "array-slice",
          array: operandNode,
          start: 0,
          end: arrayInfo.length,
        } as ArraySliceNode;
      }
    }

    // Validate that we're taking address of a variable or array slice
    if (operandNode.kind !== "variable" && operandNode.kind !== "array-slice") {
      return err("Cannot take address of non-variable expression");
    }

    // Validate that for &mut, the underlying array/variable must be mutable
    if (isMutable) {
      const targetNode =
        operandNode.kind === "array-slice" ? operandNode.array : operandNode;
      if (targetNode.kind !== "variable") {
        return err("Cannot take mutable reference to non-variable expression");
      }
      const varName = targetNode.name;
      const varResult = getVariable(parser, varName);
      if (!varResult.ok) {
        return varResult;
      }
      if (!varResult.value.mutable) {
        return err(
          `Cannot take mutable reference to immutable variable '${varName}'`,
        );
      }
    }

    return ok({
      kind: "unary-op",
      operator: isMutable ? "&mut" : "&",
      operand: operandNode,
    } as UnaryOpNode);
  }

  // Otherwise, parse postfix expression
  return parsePostfix(parser);
}

function parsePostfix(parser: Parser): Result<ASTNode, string> {
  let result = parsePrimary(parser);
  if (!result.ok) {
    return result;
  }

  let node = result.value;

  // Handle postfix operations: field access (dot) and array access (brackets)
  while (true) {
    if (current(parser).type === "DOT") {
      advance(parser); // consume DOT

      // Expect identifier for field name or property
      if (current(parser).type !== "IDENTIFIER") {
        return err("Expected field name or property after '.'");
      }
      const fieldNameTok = current(parser) as IdentifierToken;
      const fieldName = fieldNameTok.value;
      advance(parser);

      // Check if this is the 'length' property
      if (fieldName === "length") {
        // Special case for .length on arrays - return as field-access which will be handled during codegen
        node = {
          kind: "field-access",
          object: node,
          fieldName: "length",
        } as FieldAccessNode;
      } else {
        node = {
          kind: "field-access",
          object: node,
          fieldName,
        } as FieldAccessNode;
      }
    } else if (current(parser).type === "LBRACKET") {
      advance(parser); // consume [

      const arrayInfo = getArrayLikeInfo(node, parser);

      const isRangeStart =
        (current(parser).type === "DOT" &&
          parser.tokens[parser.pos + 1]?.type === "DOT") ||
        ((current(parser).type === "NUMBER" ||
          current(parser).type === "IDENTIFIER") &&
          parser.tokens[parser.pos + 1]?.type === "DOT" &&
          parser.tokens[parser.pos + 2]?.type === "DOT");

      if (isRangeStart) {
        if (!arrayInfo || arrayInfo.length === undefined) {
          return err("Can only slice arrays with known compile-time length");
        }

        let start = 0;
        let end = arrayInfo.length;

        if (
          current(parser).type !== "DOT" ||
          parser.tokens[parser.pos + 1]?.type !== "DOT"
        ) {
          const startTok = current(parser);
          if (startTok.type === "IDENTIFIER") {
            return err(
              "Array slice bounds must be constant proven in bounds; dynamic bounds not allowed",
            );
          }
          if (startTok.type !== "NUMBER") {
            return err("Expected slice start bound");
          }

          const bareStart = splitNumberLiteral(startTok.value).numericPart;
          if (bareStart.startsWith("-")) {
            return err("Array slice start must be non-negative");
          }
          if (bareStart.includes(".")) {
            return err("Array slice bounds must be integer values");
          }
          start = Number(bareStart);
          advance(parser);
        }

        if (
          current(parser).type !== "DOT" ||
          parser.tokens[parser.pos + 1]?.type !== "DOT"
        ) {
          return err("Expected '..' in array slice");
        }
        advance(parser);
        advance(parser);

        if (current(parser).type !== "RBRACKET") {
          const endTok = current(parser);
          if (endTok.type === "IDENTIFIER") {
            return err(
              "Array slice bounds must be constant proven in bounds; dynamic bounds not allowed",
            );
          }
          if (endTok.type !== "NUMBER") {
            return err("Expected slice end bound");
          }

          const bareEnd = splitNumberLiteral(endTok.value).numericPart;
          if (bareEnd.startsWith("-")) {
            return err("Array slice end must be non-negative");
          }
          if (bareEnd.includes(".")) {
            return err("Array slice bounds must be integer values");
          }
          end = Number(bareEnd);
          advance(parser);
        }

        if (current(parser).type !== "RBRACKET") {
          return err("Expected ']' after array slice");
        }
        advance(parser);

        if (start > end) {
          return err("Array slice start must be <= end");
        }
        if (end > arrayInfo.length) {
          return err(
            "Array slice end " +
              end +
              " is out of bounds for array of length " +
              arrayInfo.length,
          );
        }

        node = {
          kind: "array-slice",
          array: node,
          start,
          end,
        } as ArraySliceNode;
        continue;
      }

      // Parse index expression
      const indexResult = parseExpression(parser);
      if (!indexResult.ok) {
        return indexResult;
      }

      if (current(parser).type !== "RBRACKET") {
        return err("Expected ']' after array index");
      }
      advance(parser); // consume ]

      const indexNode = indexResult.value;

      // Validate index type and bounds
      // Get declared array length for bounds checking
      const currentArrayInfo = getArrayLikeInfo(node, parser);
      const arrLength = currentArrayInfo?.length;

      // Check index type (must be an integer type, not F32/F64/Bool/array)
      if (indexNode.kind === "variable") {
        const idxVarInfo = parser.variables.get(indexNode.name);
        if (idxVarInfo) {
          if (
            idxVarInfo.type.startsWith("F") ||
            idxVarInfo.type === "Bool" ||
            idxVarInfo.type.startsWith("[")
          ) {
            return err(
              "Array index must be an integer type, got " + idxVarInfo.type,
            );
          }
          // Dynamic variable index for read - array bounds cannot be proven safe.
          // (write side is handled in tryParseAssignment)
          if (arrLength !== undefined) {
            return err(
              "Array index must be a constant proven in bounds; dynamic index not allowed",
            );
          }
        }
      } else if (indexNode.kind === "number") {
        const numStr = indexNode.value;
        // Check for negative index
        if (numStr.startsWith("-")) {
          return err("Array index must be non-negative");
        }
        // Extract numeric value (strip type suffix)
        const bareNum = splitNumberLiteral(numStr).numericPart;
        const idxVal = parseFloat(bareNum);
        // Check for floating point index
        if (bareNum.includes(".")) {
          return err("Array index must be an integer type, got float");
        }
        if (arrLength !== undefined && idxVal >= arrLength) {
          return err(
            "Array index " +
              idxVal +
              " is out of bounds for array of length " +
              arrLength +
              ")",
          );
        }
      }

      node = {
        kind: "array-access",
        array: node,
        index: indexNode,
      } as ArrayAccessNode;
    } else {
      break;
    }
  }

  return ok(node);
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

  if (tok.type === "CHAR") {
    advance(parser);
    return ok({ kind: "char", value: tok.value });
  }

  if (tok.type === "STRING") {
    advance(parser);
    return ok({ kind: "string", value: tok.value });
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

    // Check if this is a function call (identifier followed by LPAREN)
    const nextTok = current(parser);
    if (nextTok.type === "LPAREN") {
      // Function call
      advance(parser); // consume LPAREN

      // Parse arguments
      const args: ASTNode[] = [];

      while (current(parser).type !== "RPAREN") {
        const argResult = parseExpression(parser);
        if (!argResult.ok) {
          return argResult;
        }
        args.push(argResult.value);

        // Check for comma or RPAREN
        const argNextTok = current(parser);
        if (argNextTok.type === "RPAREN") {
          break;
        } else if (argNextTok.type === "COMMA") {
          advance(parser);
        } else {
          return err("Expected ',' or ')' in function call argument list");
        }
      }

      // Expect RPAREN
      if (current(parser).type !== "RPAREN") {
        return err("Expected ')' after function arguments");
      }
      advance(parser);

      const fnInfo = parser.functions.get(name);
      let expectedArgCount: number | undefined;
      let expectedParamTypes: string[] | undefined;

      if (fnInfo) {
        expectedArgCount = fnInfo.parameters.length;
        expectedParamTypes = fnInfo.parameters.map((param) => param.type);
      } else {
        const varResult = getVariable(parser, name);
        if (!varResult.ok) {
          return err("Function or closure '" + name + "' is not defined");
        }
        const parsedFunctionType = parseFunctionTypeString(
          varResult.value.type,
        );
        if (!parsedFunctionType) {
          return err("Variable '" + name + "' is not callable");
        }
        expectedArgCount = parsedFunctionType.parameterTypes.length;
        expectedParamTypes = parsedFunctionType.parameterTypes;
      }

      // Check argument count
      if (args.length !== expectedArgCount) {
        return err(
          "Callable '" +
            name +
            "' expects " +
            expectedArgCount +
            " arguments, got " +
            args.length,
        );
      }

      for (let i = 0; i < args.length; i++) {
        const expectedType = expectedParamTypes?.[i];
        const argNode = args[i];
        if (!expectedType || !argNode) {
          continue;
        }

        const argTypeResult = inferExpressionType(argNode, parser);
        if (!argTypeResult.ok) {
          return argTypeResult;
        }
        if (
          (expectedType === "Char" || argTypeResult.value === "Char") &&
          !areTypesCompatible(expectedType, argTypeResult.value)
        ) {
          return err(
            "Argument " +
              (i + 1) +
              " for '" +
              name +
              "' expects type '" +
              expectedType +
              "' but got '" +
              argTypeResult.value +
              "'",
          );
        }
      }

      // Return a function call node
      return ok({
        kind: "function-call",
        name,
        arguments: args,
      });
    }

    // Check if this is a struct instantiation (identifier followed by LBRACE)
    if (nextTok.type === "LBRACE") {
      // Struct instantiation
      const structInfo = parser.structs.get(name);
      if (!structInfo) {
        return err("Struct '" + name + "' is not defined");
      }

      advance(parser); // consume LBRACE

      // Parse fields
      const fields: StructInstantiationField[] = [];
      const providedFields = new Set<string>();

      while (current(parser).type !== "RBRACE") {
        // Get field name
        const fieldNameTok = current(parser);
        if (fieldNameTok.type !== "IDENTIFIER") {
          return err("Expected field name in struct instantiation");
        }
        const fieldName = (fieldNameTok as IdentifierToken).value;
        advance(parser);

        // Check for duplicate field names
        if (providedFields.has(fieldName)) {
          return err(
            "Duplicate field name '" + fieldName + "' in struct instantiation",
          );
        }
        providedFields.add(fieldName);

        // Expect ':'
        if (current(parser).type !== "COLON") {
          return err("Expected ':' after field name in struct instantiation");
        }
        advance(parser);

        // Parse field value
        const valueResult = parseExpression(parser);
        if (!valueResult.ok) {
          return valueResult;
        }

        fields.push({
          name: fieldName,
          value: valueResult.value,
        });

        // Check for comma or RBRACE
        const fieldNextTok = current(parser);
        if (fieldNextTok.type === "RBRACE") {
          break;
        } else if (fieldNextTok.type === "COMMA") {
          advance(parser);
        } else {
          return err("Expected ',' or '}' in struct instantiation");
        }
      }

      // Expect RBRACE
      if (current(parser).type !== "RBRACE") {
        return err("Expected '}' after struct fields");
      }
      advance(parser);

      // Validate all required fields are provided
      for (const structField of structInfo.fields) {
        if (!providedFields.has(structField.name)) {
          return err(
            "Missing required field '" +
              structField.name +
              "' in struct instantiation",
          );
        }
      }

      // Check for extra fields
      for (const providedField of providedFields) {
        if (!structInfo.fields.find((f) => f.name === providedField)) {
          return err(
            "Unknown field '" + providedField + "' in struct instantiation",
          );
        }
      }

      // Validate field value types match declared field types
      for (const f of fields) {
        const declaredField = structInfo.fields.find(
          (sf) => sf.name === f.name,
        );
        if (!declaredField) continue;
        const isStructType = parser.structs.has(declaredField.type);
        const valueIsStruct = f.value.kind === "struct-instantiation";
        if (isStructType) {
          // Expect a struct instantiation of the correct type
          if (!valueIsStruct) {
            return err(
              "Field '" +
                f.name +
                "' expects struct type '" +
                declaredField.type +
                "'",
            );
          }
          const instNode = f.value as StructInstantiationNode;
          if (instNode.structName !== declaredField.type) {
            return err(
              "Field '" +
                f.name +
                "' expects struct '" +
                declaredField.type +
                "' but got '" +
                instNode.structName +
                "'",
            );
          }
        } else if (valueIsStruct) {
          return err(
            "Field '" + f.name + "' expects a primitive type but got a struct",
          );
        } else {
          // Check boolean vs numeric type mismatch
          const fieldIsBoolean = declaredField.type === "Bool";
          const valueIsBoolean = f.value.kind === "boolean";
          if (fieldIsBoolean && !valueIsBoolean && f.value.kind === "number") {
            return err("Field '" + f.name + "' has type Bool but got a number");
          }
          if (!fieldIsBoolean && valueIsBoolean) {
            return err(
              "Field '" +
                f.name +
                "' has type '" +
                declaredField.type +
                "' but got a boolean",
            );
          }
        }
      }

      return ok({
        kind: "struct-instantiation",
        structName: name,
        fields,
      });
    }

    // Variable reference - just check it exists
    const varResult = getVariable(parser, name);
    if (!varResult.ok) {
      return varResult;
    }

    return ok({ kind: "variable", name });
  }

  if (tok.type === "LPAREN") {
    const closureResult = tryParseClosureLiteral(parser);
    if (!closureResult.ok) {
      return closureResult;
    }
    if (closureResult.value) {
      return ok(closureResult.value);
    }

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

  // Delegate if/match to parseExpression (avoids duplicate dispatch)
  if (tok.type === "KEYWORD" && (tok.value === "if" || tok.value === "match")) {
    return parseExpression(parser);
  }

  // Array literals [expr, expr, ...] or generator construction [callable; count]
  if (tok.type === "LBRACKET") {
    advance(parser); // consume [

    const elements: ASTNode[] = [];

    if (current(parser).type === "RBRACKET") {
      advance(parser); // consume ]
      return ok({
        kind: "array-literal",
        elements,
      } as ArrayLiteralNode);
    }

    let firstElementResult: Result<ASTNode, string>;
    if (
      current(parser).type === "IDENTIFIER" &&
      parser.functions.has((current(parser) as IdentifierToken).value) &&
      parser.tokens[parser.pos + 1]?.type === "SEMICOLON"
    ) {
      firstElementResult = ok({
        kind: "variable",
        name: (current(parser) as IdentifierToken).value,
      } as VariableNode);
      advance(parser);
    } else {
      firstElementResult = parseExpression(parser);
    }

    if (!firstElementResult.ok) {
      return firstElementResult;
    }

    if (current(parser).type === "SEMICOLON") {
      advance(parser);

      const repeatCountTok = current(parser);
      if (repeatCountTok.type !== "NUMBER") {
        return err("Expected array repeat count as number");
      }

      const repeatCountValue = repeatCountTok.value;
      if (!isBareNonNegativeIntegerLiteral(repeatCountValue)) {
        return err(
          "Expected array repeat count as a non-negative integer literal",
        );
      }
      const repeatCount = Number(repeatCountValue);
      advance(parser);

      if (current(parser).type !== "RBRACKET") {
        return err("Expected ']' after array repeat count");
      }
      advance(parser); // consume ]

      return ok({
        kind: "array-literal",
        elements,
        generator: firstElementResult.value,
        repeatCount,
      } as ArrayLiteralNode);
    }

    elements.push(firstElementResult.value);

    while (current(parser).type !== "RBRACKET") {
      const nextTok = current(parser);
      if (nextTok.type === "RBRACKET") {
        break;
      } else if (nextTok.type === "COMMA") {
        advance(parser); // consume comma
        const elemResult = parseExpression(parser);
        if (!elemResult.ok) {
          return elemResult;
        }
        elements.push(elemResult.value);
      } else {
        return err("Expected ',' or ']' in array literal");
      }
    }

    if (current(parser).type !== "RBRACKET") {
      return err("Expected ']' after array literal");
    }
    advance(parser); // consume ]

    return ok({
      kind: "array-literal",
      elements,
    } as ArrayLiteralNode);
  }

  return err("Unexpected token: " + tok.type);
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
    return err("Cannot apply negative sign to unsigned type: " + literal);
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

  if (node.kind === "string") {
    return "[" + node.value.join(", ") + "]";
  }

  if (node.kind === "char") {
    return node.value;
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
    return "let " + node.name + " = " + init;
  }

  if (node.kind === "assign") {
    const value = codegenAST(node.value);
    return node.name + " = " + value;
  }

  if (node.kind === "deref-assign") {
    const value = codegenAST(node.value);
    // If we know which variable the pointer points to, assign to that variable
    if (node.targetVar) {
      return node.targetVar + " = " + value;
    }
    // Otherwise, fall back to assigning through the pointer
    const target = codegenAST(node.target);
    return target + " = " + value;
  }

  if (
    node.kind === "binary" ||
    node.kind === "comparison" ||
    node.kind === "logical"
  ) {
    const left = codegenAST(node.left);
    const right = codegenAST(node.right);
    // For division with integer types, use Math.trunc for integer division
    if (node.kind === "binary" && node.operator === "/") {
      return "(Math.trunc(" + left + " / " + right + "))";
    }
    return "(" + left + " " + node.operator + " " + right + ")";
  }

  if (node.kind === "unary-logical") {
    const operand = codegenAST(node.operand);
    return "(!" + operand + ")";
  }

  if (node.kind === "unary-op") {
    if (node.operator === "*") {
      const operand = codegenAST(node.operand);
      // Dereference: *ptr -> ptr (in a simple interpreter, values are already dereferenced)
      return operand;
    } else if (node.operator === "&" || node.operator === "&mut") {
      if (node.operand.kind === "array-slice") {
        return codegenAST(node.operand);
      }

      const operand = codegenAST(node.operand);
      // Address-of: &x -> x (in our simple model, we just return the variable/value)
      return operand;
    }
  }

  if (node.kind === "block") {
    const statements = generateStatementCode(node.statements);
    const result = codegenAST(node.result);
    return statements + " return " + result;
  }

  if (node.kind === "if") {
    const condition = codegenAST(node.condition);

    let thenCode = "";
    if (node.thenBranch.kind === "block") {
      // Check if block has a meaningful final expression (not just 0)
      const hasResult =
        node.thenBranch.result &&
        !(
          node.thenBranch.result.kind === "number" &&
          node.thenBranch.result.value === "0"
        );

      const stmtCode = generateStatementCode(node.thenBranch.statements);
      if (hasResult && node.elseBranch) {
        // Block with meaningful result and there's an else - it's an expression
        const resultCode = codegenAST(node.thenBranch.result);
        thenCode = stmtCode + " return " + resultCode;
      } else {
        // Just statements, no meaningful result
        thenCode = stmtCode;
      }
    } else {
      thenCode = codegenAST(node.thenBranch);
    }

    if (node.elseBranch === undefined) {
      // if without else - used as statement
      return "if (" + condition + ") { " + thenCode + " }";
    }

    // if with else - generate else branch code
    let elseCode = "";
    if (node.elseBranch.kind === "block") {
      // Check if block has a meaningful final expression
      const hasResult =
        node.elseBranch.result &&
        !(
          node.elseBranch.result.kind === "number" &&
          node.elseBranch.result.value === "0"
        );

      const stmtCode = generateStatementCode(node.elseBranch.statements);
      if (hasResult) {
        const resultCode = codegenAST(node.elseBranch.result);
        elseCode = stmtCode + " return " + resultCode;
      } else {
        elseCode = stmtCode;
      }
    } else if (node.elseBranch.kind === "if") {
      // else if - the recursive call will generate the correct syntax
      // For nested if nodes, we need to generate them as expressions if blocks are involved
      const innerIfCode = codegenAST(node.elseBranch);

      if (node.thenBranch.kind === "block") {
        // Then has statements, use if/else syntax
        return (
          "if (" + condition + ") { " + thenCode + " } else " + innerIfCode
        );
      } else {
        // Both are non-block expressions, so treat as full ternary
        return "(" + condition + " ? " + thenCode + " : " + innerIfCode + ")";
      }
    } else {
      elseCode = codegenAST(node.elseBranch);
    }

    // Check if both branches are simple expressions without statements or blocks
    if (node.thenBranch.kind !== "block" && node.elseBranch.kind !== "block") {
      // Both are simple expressions - use ternary
      return "(" + condition + " ? " + thenCode + " : " + elseCode + ")";
    } else {
      // At least one has statements - need to wrap as expression
      // Use IIFE to convert if statement to expression
      return (
        "(function() { if (" +
        condition +
        ") { " +
        thenCode +
        " } else { " +
        elseCode +
        " } }())"
      );
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

    return "while (" + condition + ") { " + bodyCode + " }";
  }

  if (node.kind === "break") {
    return "break";
  }

  if (node.kind === "continue") {
    return "continue";
  }

  if (node.kind === "return") {
    const value = codegenAST(node.value);
    return "return " + value;
  }

  if (node.kind === "match") {
    const matchExpr = codegenAST(node.matchExpr);

    // Generate ternary chain for match cases
    // match (x) { case 1 => 10; case 2 => 20; case _ => 0; }
    // becomes: x === 1 ? 10 : x === 2 ? 20 : 0
    let result = "";
    let wildcardCase: MatchCase | undefined;
    const regularCases: MatchCase[] = [];

    for (const c of node.cases) {
      if (c.pattern.type === "wildcard") {
        wildcardCase = c;
      } else {
        regularCases.push(c);
      }
    }

    // Check if all non-wildcard cases are boolean (exhaustive boolean match)
    const isExhaustiveBooleanMatch =
      regularCases.length > 0 &&
      regularCases.every((c) => c.pattern.type === "boolean") &&
      regularCases.length === 2 &&
      regularCases.some((c) => (c.pattern as any).value === true) &&
      regularCases.some((c) => (c.pattern as any).value === false);

    // Build ternary chain for all cases
    if (isExhaustiveBooleanMatch) {
      // Special handling for exhaustive boolean: x === 1 ? trueValue : falseValue
      const trueCase = regularCases.find(
        (c) => (c.pattern as any).value === true,
      );
      const falseCase = regularCases.find(
        (c) => (c.pattern as any).value === false,
      );
      if (trueCase && falseCase) {
        const trueResult = codegenAST(trueCase.result);
        const falseResult = codegenAST(falseCase.result);
        result = matchExpr + " === 1 ? " + trueResult + " : " + falseResult;
      }
    } else {
      // Regular ternary chain
      regularCases.forEach((c, i) => {
        const caseResult = codegenAST(c.result);

        if (c.pattern.type === "literal") {
          result += matchExpr + " === " + c.pattern.value + " ? " + caseResult;
        } else if (c.pattern.type === "boolean") {
          result +=
            matchExpr + " === " + c.pattern.value
              ? "1"
              : "0" + " ? " + caseResult;
        }

        if (i < regularCases.length - 1 || wildcardCase) {
          result += " : ";
        }
      });

      // Add wildcard case at the end
      if (wildcardCase) {
        const wildcardResult = codegenAST(wildcardCase.result);
        result += wildcardResult;
      }
    }

    return "(" + result + ")";
  }

  if (node.kind === "function") {
    return codegenFunctionLikeDeclaration(
      node.name,
      node.parameters,
      node.returnType,
      node.body,
    );
  }

  if (node.kind === "closure") {
    return codegenFunctionLikeDeclaration(
      undefined,
      node.parameters,
      node.returnType,
      node.body,
    );
  }

  if (node.kind === "function-call") {
    // Generate function call
    const argList = node.arguments.map((arg) => codegenAST(arg)).join(", ");

    return node.name + "(" + argList + ")";
  }

  if (node.kind === "struct") {
    // Struct declarations don't generate code themselves
    // They are just type definitions
    return "0";
  }

  if (node.kind === "struct-instantiation") {
    // Generate struct instantiation as JavaScript object
    const fields = node.fields
      .map((f) => {
        const value = codegenAST(f.value);
        return f.name + ": " + value;
      })
      .join(", ");

    return "{ " + fields + " }";
  }

  if (node.kind === "array-literal") {
    if (node.generator && node.repeatCount !== undefined) {
      const generator = codegenAST(node.generator);
      return (
        "(() => { const _tuffArray = []; const _tuffGenerator = (" +
        generator +
        "); for (let _tuffIndex = 0; _tuffIndex < " +
        node.repeatCount +
        "; _tuffIndex += 1) { _tuffArray.push(_tuffGenerator()); } return _tuffArray; })()"
      );
    }

    // Generate array literal as a JavaScript array.
    const elements = node.elements.map((elem) => codegenAST(elem));
    return "[" + elements.join(", ") + "]";
  }

  if (node.kind === "array-access") {
    const array = codegenAST(node.array);
    const index = codegenAST(node.index);
    return (
      "(() => { const _tuffArray = " +
      array +
      "; const _tuffIndex = " +
      index +
      "; return _tuffArray && _tuffArray.__tuffSlice ? _tuffArray.data[_tuffArray.start + _tuffIndex] : _tuffArray[_tuffIndex]; })()"
    );
  }

  if (node.kind === "array-slice") {
    const array = codegenAST(node.array);
    return (
      "(() => { const _tuffArray = " +
      array +
      "; const _tuffBase = _tuffArray && _tuffArray.__tuffSlice ? _tuffArray.data : _tuffArray; const _tuffStartOffset = _tuffArray && _tuffArray.__tuffSlice ? _tuffArray.start : 0; const _tuffStart = _tuffStartOffset + " +
      node.start +
      "; const _tuffEnd = _tuffStartOffset + " +
      node.end +
      "; return { __tuffSlice: true, data: _tuffBase, start: _tuffStart, end: _tuffEnd, length: _tuffEnd - _tuffStart }; })()"
    );
  }

  if (node.kind === "array-assign") {
    const array = codegenAST(node.array);
    const index = codegenAST(node.index);
    const value = codegenAST(node.value);
    return (
      "(() => { const _tuffArray = " +
      array +
      "; const _tuffIndex = " +
      index +
      "; const _tuffValue = " +
      value +
      "; if (_tuffArray && _tuffArray.__tuffSlice) { _tuffArray.data[_tuffArray.start + _tuffIndex] = _tuffValue; } else { _tuffArray[_tuffIndex] = _tuffValue; } return _tuffValue; })()"
    );
  }

  if (node.kind === "field-access") {
    // Generate field access
    const obj = codegenAST(node.object);
    return obj + "." + node.fieldName;
  }

  if (node.kind === "field-assign") {
    // Generate field assignment
    const obj = codegenAST(node.object);
    const value = codegenAST(node.value);
    return obj + "." + node.fieldName + " = " + value;
  }

  return "0";
}

/**
 * Helper to validate expressions used in value contexts where they must produce a value
 * (e.g., initializers, returns, if branches)
 */
function validateExpressionAsValue(node: ASTNode): Result<undefined, string> {
  // If expressions without else cannot be used in value contexts
  if (node.kind === "if" && node.elseBranch === undefined) {
    return err(
      "If expression without else clause cannot be used in value context",
    );
  }

  return validateAST(node);
}

function validateAST(node: ASTNode): Result<undefined, string> {
  if (node.kind === "number") {
    return validateNegativeType(node.value);
  }

  if (node.kind === "boolean") {
    return ok(undefined);
  }

  if (node.kind === "char") {
    return ok(undefined);
  }

  if (node.kind === "string") {
    return ok(undefined);
  }

  if (node.kind === "read" || node.kind === "variable") {
    return ok(undefined);
  }

  if (node.kind === "let") {
    // Validate initializer expression - must produce a value
    return validateExpressionAsValue(node.initializer);
  }

  if (node.kind === "assign") {
    return validateAST(node.value);
  }

  if (node.kind === "unary-op") {
    return validateAST(node.operand);
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

  if (node.kind === "return") {
    // Validate return value - must produce a value
    return validateExpressionAsValue(node.value);
  }

  if (node.kind === "match") {
    // Validate match expression
    const exprValidation = validateAST(node.matchExpr);
    if (!exprValidation.ok) {
      return exprValidation;
    }

    // Validate all case results
    for (const c of node.cases) {
      const caseValidation = validateAST(c.result);
      if (!caseValidation.ok) {
        return caseValidation;
      }
    }

    return ok(undefined);
  }

  if (node.kind === "function") {
    // Validate function body
    return validateAST(node.body);
  }

  if (node.kind === "closure") {
    return validateAST(node.body);
  }

  if (node.kind === "function-call") {
    // Validate function call arguments
    for (const arg of node.arguments) {
      const argValidation = validateAST(arg);
      if (!argValidation.ok) {
        return argValidation;
      }
    }
    return ok(undefined);
  }

  if (node.kind === "struct") {
    // Structs are just declarations, no body validation needed
    return ok(undefined);
  }

  if (node.kind === "array-literal") {
    if (node.generator) {
      return validateAST(node.generator);
    }

    for (const element of node.elements) {
      const elementValidation = validateAST(element);
      if (!elementValidation.ok) {
        return elementValidation;
      }
    }
    return ok(undefined);
  }

  if (node.kind === "array-access") {
    const arrayValidation = validateAST(node.array);
    if (!arrayValidation.ok) {
      return arrayValidation;
    }
    return validateAST(node.index);
  }

  if (node.kind === "array-slice") {
    return validateAST(node.array);
  }

  if (node.kind === "array-assign") {
    const arrayValidation = validateAST(node.array);
    if (!arrayValidation.ok) {
      return arrayValidation;
    }
    const indexValidation = validateAST(node.index);
    if (!indexValidation.ok) {
      return indexValidation;
    }
    return validateAST(node.value);
  }

  if (node.kind === "struct-instantiation") {
    // Validate all field values
    for (const field of node.fields) {
      const fieldValidation = validateAST(field.value);
      if (!fieldValidation.ok) {
        return fieldValidation;
      }
    }
    return ok(undefined);
  }

  if (node.kind === "field-access") {
    // Validate the object being accessed
    return validateAST(node.object);
  }

  if (node.kind === "field-assign") {
    // Validate the object being assigned to and the value
    const objectValidation = validateAST(node.object);
    if (!objectValidation.ok) {
      return objectValidation;
    }
    return validateAST(node.value);
  }

  return ok(undefined);
}

/**
 * Consumes the current keyword token then returns the following identifier
 * name, restoring parser.pos to savedPos on failure.
 */
function consumeKeywordAndGetName(
  parser: Parser,
  savedPos: number,
  errorMsg: string,
): Result<string, string> {
  advance(parser); // consume keyword
  const nameTok = current(parser);
  if (nameTok.type !== "IDENTIFIER") {
    parser.pos = savedPos;
    return err(errorMsg);
  }
  const name = (nameTok as IdentifierToken).value;
  advance(parser);
  return ok(name);
}

/**
 * Runs a prescan pass over all tokens, calling `handler` for each keyword
 * match. The handler receives the saved original position so it can restore
 * on error. If the handler returns ok(false) the generic loop advances past
 * the current (non-matching) token; returning ok(true) means the handler
 * already advanced the parser.
 */
function runPrescan(
  parser: Parser,
  keyword: string,
  handler: CallableFunction,
): Result<void, string> {
  const savedPos = parser.pos;
  parser.pos = 0;

  while (current(parser).type !== "EOF") {
    const tok = current(parser);
    if (tok.type === "KEYWORD" && tok.value === keyword) {
      const result = handler(savedPos) as Result<void, string>;
      if (!result.ok) return result;
    } else {
      advance(parser);
    }
  }

  parser.pos = savedPos;
  return ok(undefined);
}

/**
 * Helper to register all struct definitions before parsing bodies
 * Supports nested structs and struct field types
 */
function prescanStructDefinitions(parser: Parser): Result<void, string> {
  return runPrescan(parser, "struct", (savedPos: number) => {
    const nameResult = consumeKeywordAndGetName(
      parser,
      savedPos,
      "Expected struct name",
    );
    if (!nameResult.ok) return nameResult;
    const structName = nameResult.value;

    const fieldsResult = parseStructFieldList(parser);
    if (!fieldsResult.ok) {
      parser.pos = savedPos;
      return fieldsResult;
    }

    // Register struct
    if (!parser.structs.has(structName)) {
      parser.structs.set(structName, { fields: fieldsResult.value });
    } else {
      parser.pos = savedPos;
      return err("Struct '" + structName + "' already declared");
    }

    return ok(undefined);
  });
}

/**
 * Helper to register all function signatures before parsing bodies
 * Supports mutual recursion by allowing functions to reference each other
 */
function prescanFunctionSignatures(parser: Parser): Result<void, string> {
  return runPrescan(parser, "fn", (savedPos: number) => {
    const nameResult = consumeKeywordAndGetName(
      parser,
      savedPos,
      "Expected function name",
    );
    if (!nameResult.ok) return nameResult;
    const functionName = nameResult.value;

    if (current(parser).type !== "LPAREN") {
      parser.pos = savedPos;
      return err("Expected '(' after function name");
    }
    advance(parser);

    const parametersResult = parseFunctionParameters(parser, false);
    if (!parametersResult.ok) {
      parser.pos = savedPos;
      return parametersResult;
    }
    const parameters = parametersResult.value;

    if (current(parser).type !== "COLON") {
      parser.pos = savedPos;
      return err("Expected ':' before return type");
    }
    advance(parser);

    const returnTypeResult = parseTypeValue(parser);
    if (!returnTypeResult.ok) {
      parser.pos = savedPos;
      return returnTypeResult;
    }
    advance(parser);

    if (!parser.functions.has(functionName)) {
      parser.functions.set(functionName, {
        parameters,
        returnType: returnTypeResult.value,
      });
    } else {
      parser.pos = savedPos;
      return err("Function '" + functionName + "' already declared");
    }

    if (current(parser).type === "ARROW") {
      advance(parser);
    }

    if (current(parser).type === "LBRACE") {
      let braceDepth = 1;
      advance(parser);
      while (braceDepth > 0 && current(parser).type !== "EOF") {
        if (current(parser).type === "LBRACE") braceDepth++;
        else if (current(parser).type === "RBRACE") braceDepth--;
        advance(parser);
      }
    } else {
      while (
        current(parser).type !== "SEMICOLON" &&
        current(parser).type !== "EOF"
      ) {
        advance(parser);
      }
      if (current(parser).type === "SEMICOLON") {
        advance(parser);
      }
    }

    return ok(undefined);
  });
}

/**
 * Returns the struct name for the given node if it's a struct-instantiation,
 * or looks up the variable type for a variable node.
 */
function getNodeStructType(
  node: ASTNode,
  structs: Map<string, StructInfo>,
  typeEnv: Map<string, string>,
): string | undefined {
  if (node.kind === "struct-instantiation") {
    return (node as StructInstantiationNode).structName;
  }
  if (node.kind === "variable") {
    const t = typeEnv.get(node.name);
    return t && structs.has(t) ? t : undefined;
  }
  if (node.kind === "field-access") {
    const parentType = getNodeStructType(node.object, structs, typeEnv);
    if (!parentType) return undefined;
    const structInfo = structs.get(parentType);
    const field = structInfo?.fields.find((f) => f.name === node.fieldName);
    return field && structs.has(field.type) ? field.type : undefined;
  }
  return undefined;
}

/**
 * Validates struct field access, mutability, and type compatibility.
 * 'typeEnv' maps variable names to their declared types.
 */
function validateStructSemantics(
  node: ASTNode,
  structs: Map<string, StructInfo>,
  typeEnv: Map<string, string>,
): Result<undefined, string> {
  if (node.kind === "let") {
    const letNode = node as LetNode;
    // Check struct vs primitive type mismatch
    if (
      letNode.initializer.kind === "struct-instantiation" &&
      !structs.has(letNode.type)
    ) {
      return err(
        "Type mismatch: cannot assign struct to variable of type '" +
          letNode.type +
          "'",
      );
    }
    if (
      structs.has(letNode.type) &&
      letNode.initializer.kind !== "struct-instantiation" &&
      letNode.initializer.kind !== "variable" &&
      letNode.initializer.kind !== "field-access"
    ) {
      // Only error if initializer is clearly not a struct (e.g. a number literal)
      if (
        letNode.initializer.kind === "number" ||
        letNode.initializer.kind === "boolean"
      ) {
        return err(
          "Type mismatch: variable '" +
            letNode.name +
            "' expects struct type '" +
            letNode.type +
            "'",
        );
      }
    }
    // Register variable type in environment for sub-expressions
    typeEnv = new Map(typeEnv);
    typeEnv.set(letNode.name, letNode.type);
    return validateStructSemantics(letNode.initializer, structs, typeEnv);
  }

  if (node.kind === "field-access" || node.kind === "field-assign") {
    const objResult = validateStructSemantics(node.object, structs, typeEnv);
    if (!objResult.ok) return objResult;

    const structType = getNodeStructType(node.object, structs, typeEnv);
    const structInfo = structType ? structs.get(structType) : undefined;

    if (node.kind === "field-access") {
      if (
        structInfo &&
        !structInfo.fields.find((f) => f.name === node.fieldName)
      ) {
        return err(
          "Struct '" + structType + "' has no field '" + node.fieldName + "'",
        );
      }
      return ok(undefined);
    }

    // field-assign
    if (structInfo) {
      const field = structInfo.fields.find((f) => f.name === node.fieldName);
      if (field && !field.mutable) {
        return err(
          "Field '" +
            node.fieldName +
            "' of struct '" +
            structType +
            "' is read-only",
        );
      }
    }
    return validateStructSemantics(node.value, structs, typeEnv);
  }

  // For block nodes, thread the typeEnv through sequentially
  if (node.kind === "block") {
    let env = typeEnv;
    for (const stmt of node.statements) {
      if (stmt.kind === "let") {
        const r = validateStructSemantics(stmt, structs, env);
        if (!r.ok) return r;
        // Update env after let
        env = new Map(env);
        env.set((stmt as LetNode).name, (stmt as LetNode).type);
      } else {
        const r = validateStructSemantics(stmt, structs, env);
        if (!r.ok) return r;
      }
    }
    return validateStructSemantics(node.result, structs, env);
  }

  // Recurse into child nodes generically
  if (
    node.kind === "binary" ||
    node.kind === "comparison" ||
    node.kind === "logical"
  ) {
    const l = validateStructSemantics(node.left, structs, typeEnv);
    if (!l.ok) return l;
    return validateStructSemantics(node.right, structs, typeEnv);
  }

  if (node.kind === "unary-logical") {
    return validateStructSemantics(node.operand, structs, typeEnv);
  }

  if (node.kind === "if") {
    const c = validateStructSemantics(node.condition, structs, typeEnv);
    if (!c.ok) return c;
    const t = validateStructSemantics(node.thenBranch, structs, typeEnv);
    if (!t.ok) return t;
    if (node.elseBranch) {
      return validateStructSemantics(node.elseBranch, structs, typeEnv);
    }
    return ok(undefined);
  }

  if (node.kind === "while") {
    const c = validateStructSemantics(node.condition, structs, typeEnv);
    if (!c.ok) return c;
    return validateStructSemantics(node.body, structs, typeEnv);
  }

  if (node.kind === "function") {
    // Build parameter type env for function body
    const fnEnv = new Map(typeEnv);
    for (const p of (node as FunctionNode).parameters) {
      fnEnv.set(p.name, p.type);
    }
    return validateStructSemantics(node.body, structs, fnEnv);
  }

  if (node.kind === "closure") {
    const closureEnv = new Map(typeEnv);
    for (const p of node.parameters) {
      closureEnv.set(p.name, p.type);
    }
    return validateStructSemantics(node.body, structs, closureEnv);
  }

  if (node.kind === "function-call") {
    for (const arg of node.arguments) {
      const r = validateStructSemantics(arg, structs, typeEnv);
      if (!r.ok) return r;
    }
    return ok(undefined);
  }

  if (node.kind === "array-literal") {
    if (node.generator) {
      return validateStructSemantics(node.generator, structs, typeEnv);
    }

    for (const element of node.elements) {
      const r = validateStructSemantics(element, structs, typeEnv);
      if (!r.ok) return r;
    }
    return ok(undefined);
  }

  if (node.kind === "array-access") {
    const arrayResult = validateStructSemantics(node.array, structs, typeEnv);
    if (!arrayResult.ok) return arrayResult;
    return validateStructSemantics(node.index, structs, typeEnv);
  }

  if (node.kind === "array-slice") {
    return validateStructSemantics(node.array, structs, typeEnv);
  }

  if (node.kind === "array-assign") {
    const arrayResult = validateStructSemantics(node.array, structs, typeEnv);
    if (!arrayResult.ok) return arrayResult;
    const indexResult = validateStructSemantics(node.index, structs, typeEnv);
    if (!indexResult.ok) return indexResult;
    return validateStructSemantics(node.value, structs, typeEnv);
  }

  if (node.kind === "unary-op") {
    return validateStructSemantics(node.operand, structs, typeEnv);
  }

  if (node.kind === "struct-instantiation") {
    for (const f of (node as StructInstantiationNode).fields) {
      const r = validateStructSemantics(f.value, structs, typeEnv);
      if (!r.ok) return r;
    }
    return ok(undefined);
  }

  if (node.kind === "return") {
    return validateStructSemantics(node.value, structs, typeEnv);
  }

  if (node.kind === "assign") {
    return validateStructSemantics(node.value, structs, typeEnv);
  }

  return ok(undefined);
}

export function compile(input: string): Result<string, string> {
  const DEBUG = false; // Set to true to enable debug logging

  if (DEBUG) console.log("[COMPILE START]", input.substring(0, 100));

  // Empty input returns 0
  if (input === "") {
    return ok("return 0;");
  }

  // Reject leading or trailing whitespace
  if (input !== input.trim()) {
    return err("Leading or trailing whitespace is not allowed");
  }

  // Tokenize
  if (DEBUG) console.log("[TOKENIZE]");
  const tokenResult = tokenize(input);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  // Parse
  if (DEBUG) console.log("[PARSE START]");
  const tokens = tokenResult.value;
  if (DEBUG) console.log("[TOKENS] " + tokens.length + " tokens");
  const parser: Parser = {
    tokens,
    pos: 0,
    variables: new Map(),
    functions: new Map(),
    structs: new Map(),
    inLoop: false,
    currentFunctionReturnType: undefined,
    provenConstraints: new Map(),
  };

  // Pre-scan for struct definitions to support nested structs
  if (DEBUG) console.log("[PRESCAN STRUCTS]");
  const structPrescanResult = prescanStructDefinitions(parser);
  if (!structPrescanResult.ok) {
    return structPrescanResult;
  }
  if (DEBUG)
    console.log(
      "[STRUCT PRESCAN DONE] " + parser.structs.size + " structs found",
    );

  // Pre-scan for function signatures to support mutual recursion
  if (DEBUG) console.log("[PRESCAN FUNCTIONS]");
  const prescanResult = prescanFunctionSignatures(parser);
  if (!prescanResult.ok) {
    return prescanResult;
  }
  if (DEBUG)
    console.log(
      "[FUNCTION PRESCAN DONE] " + parser.functions.size + " functions found",
    );

  if (DEBUG) console.log("[PARSE PROGRAM]");
  const astResult = parseProgram(parser);
  if (!astResult.ok) {
    return astResult;
  }
  if (DEBUG) console.log("[AST PARSED]");

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

  // Semantic struct validation (field existence, readonly, type mismatch)
  const structSemanticsResult = validateStructSemantics(
    ast,
    parser.structs,
    new Map(),
  );
  if (!structSemanticsResult.ok) {
    return structSemanticsResult;
  }

  // Generate code
  const code = codegenAST(ast);
  if (ast.kind === "block") {
    return ok(code + ";");
  }

  return ok("return " + code + ";");
}

export const compileTuffToJS = compile;
