type IntegerType = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";
type FloatType = "F32" | "F64";
type NumericType = IntegerType | FloatType;

type NumericKind = "int" | "float";

const INTEGER_TYPE_ORDER: IntegerType[] = [
  "U8",
  "I8",
  "U16",
  "I16",
  "U32",
  "I32",
  "U64",
  "I64",
];

const INTEGER_RANGES: Record<IntegerType, { min: bigint; max: bigint }> = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

const F32_MAX = 3.4028234663852886e38;

class TuffParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TuffParseError";
  }
}

class TuffRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TuffRuntimeError";
  }
}

type Expr =
  | { kind: "literal"; text: string; type: NumericType }
  | { kind: "read"; type: NumericType }
  | { kind: "unary"; operator: "-"; operand: Expr }
  | {
      kind: "binary";
      operator: "+" | "-" | "*" | "/";
      left: Expr;
      right: Expr;
    };

type IntegerValue = {
  kind: "int";
  type: IntegerType;
  value: bigint;
};

type FloatValue = {
  kind: "float";
  type: FloatType;
  value: number;
};

type TypedValue = IntegerValue | FloatValue;

type Token =
  | { kind: "number"; text: string }
  | { kind: "type"; text: NumericType }
  | { kind: "ident"; text: string }
  | { kind: "operator"; text: "+" | "-" | "*" | "/" | "<" | ">" | "(" | ")" }
  | { kind: "eof" };

class Tokenizer {
  private readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  peek(): Token {
    const savedIndex = this.index;
    const token = this.next();
    this.index = savedIndex;
    return token;
  }

  next(): Token {
    this.skipWhitespace();

    if (this.index >= this.source.length) {
      return { kind: "eof" };
    }

    const currentChar = this.source[this.index];

    if (
      currentChar === "+" ||
      currentChar === "-" ||
      currentChar === "*" ||
      currentChar === "/" ||
      currentChar === "<" ||
      currentChar === ">" ||
      currentChar === "(" ||
      currentChar === ")"
    ) {
      this.index += 1;
      return { kind: "operator", text: currentChar };
    }

    if (this.isDigit(currentChar)) {
      const start = this.index;
      while (
        this.index < this.source.length &&
        this.isDigit(this.source[this.index])
      ) {
        this.index += 1;
      }

      if (this.index < this.source.length && this.source[this.index] === ".") {
        this.index += 1;
        while (
          this.index < this.source.length &&
          this.isDigit(this.source[this.index])
        ) {
          this.index += 1;
        }
      }

      return { kind: "number", text: this.source.slice(start, this.index) };
    }

    if (this.isIdentifierStart(currentChar)) {
      const start = this.index;
      this.index += 1;
      while (
        this.index < this.source.length &&
        this.isIdentifierPart(this.source[this.index])
      ) {
        this.index += 1;
      }

      const text = this.source.slice(start, this.index);
      if (isNumericType(text)) {
        return { kind: "type", text };
      }

      return { kind: "ident", text };
    }

    throw new TuffParseError(
      `Unexpected character '${currentChar}' at position ${this.index + 1}.`,
    );
  }

  private skipWhitespace(): void {
    while (
      this.index < this.source.length &&
      /\s/u.test(this.source[this.index])
    ) {
      this.index += 1;
    }
  }

  private isDigit(character: string): boolean {
    return character >= "0" && character <= "9";
  }

  private isIdentifierStart(character: string): boolean {
    return /[A-Za-z_]/u.test(character);
  }

  private isIdentifierPart(character: string): boolean {
    return /[A-Za-z0-9_]/u.test(character);
  }
}

function isNumericType(type: string): type is NumericType {
  return (
    type === "U8" ||
    type === "U16" ||
    type === "U32" ||
    type === "U64" ||
    type === "I8" ||
    type === "I16" ||
    type === "I32" ||
    type === "I64" ||
    type === "F32" ||
    type === "F64"
  );
}

function isFloatType(type: NumericType): type is FloatType {
  return type === "F32" || type === "F64";
}

function isIntegerType(type: NumericType): type is IntegerType {
  return !isFloatType(type);
}

function parseProgram(source: string): Expr {
  const tokenizer = new Tokenizer(source);
  const expression = parseExpression(tokenizer);
  const trailingToken = tokenizer.next();

  if (trailingToken.kind !== "eof") {
    throw new TuffParseError("Unexpected trailing input.");
  }

  return expression;
}

function parseExpression(tokenizer: Tokenizer): Expr {
  return parseAdditive(tokenizer);
}

function parseAdditive(tokenizer: Tokenizer): Expr {
  let expression = parseMultiplicative(tokenizer);

  while (true) {
    const nextToken = tokenizer.peek();
    if (
      nextToken.kind !== "operator" ||
      (nextToken.text !== "+" && nextToken.text !== "-")
    ) {
      return expression;
    }

    tokenizer.next();
    const right = parseMultiplicative(tokenizer);
    expression = {
      kind: "binary",
      operator: nextToken.text,
      left: expression,
      right,
    };
  }
}

function parseMultiplicative(tokenizer: Tokenizer): Expr {
  let expression = parseUnary(tokenizer);

  while (true) {
    const nextToken = tokenizer.peek();
    if (
      nextToken.kind !== "operator" ||
      (nextToken.text !== "*" && nextToken.text !== "/")
    ) {
      return expression;
    }

    tokenizer.next();
    const right = parseUnary(tokenizer);
    expression = {
      kind: "binary",
      operator: nextToken.text,
      left: expression,
      right,
    };
  }
}

function parseUnary(tokenizer: Tokenizer): Expr {
  const nextToken = tokenizer.peek();
  if (nextToken.kind === "operator" && nextToken.text === "-") {
    tokenizer.next();
    const operand = parseUnary(tokenizer);

    if (operand.kind === "literal") {
      return negateLiteralExpression(operand);
    }

    return {
      kind: "unary",
      operator: "-",
      operand,
    };
  }

  return parsePrimary(tokenizer);
}

function negateLiteralExpression(
  literal: Extract<Expr, { kind: "literal" }>,
): Expr {
  if (isIntegerType(literal.type) && literal.type.startsWith("U")) {
    throw new TuffRuntimeError(
      `Negative literals are not allowed for unsigned type ${literal.type}.`,
    );
  }

  const negatedText = literal.text.startsWith("-")
    ? literal.text.slice(1)
    : `-${literal.text}`;

  return {
    kind: "literal",
    text: negatedText,
    type: literal.type,
  };
}

function parsePrimary(tokenizer: Tokenizer): Expr {
  const nextToken = tokenizer.next();

  if (nextToken.kind === "number") {
    const typeToken = tokenizer.next();
    if (typeToken.kind !== "type") {
      throw new TuffParseError("Numeric literal is missing a type suffix.");
    }

    return {
      kind: "literal",
      text: nextToken.text,
      type: typeToken.text,
    };
  }

  if (nextToken.kind === "ident" && nextToken.text === "read") {
    expectOperator(tokenizer, "<");
    const typeToken = tokenizer.next();
    if (typeToken.kind !== "type") {
      throw new TuffParseError("read<T>() requires a numeric type parameter.");
    }
    expectOperator(tokenizer, ">");
    expectOperator(tokenizer, "(");
    expectOperator(tokenizer, ")");

    return {
      kind: "read",
      type: typeToken.text,
    };
  }

  if (nextToken.kind === "operator" && nextToken.text === "(") {
    const expression = parseExpression(tokenizer);
    expectOperator(tokenizer, ")");
    return expression;
  }

  throw new TuffParseError(
    "Expected a numeric literal, read<T>(), or grouped expression.",
  );
}

function expectOperator(
  tokenizer: Tokenizer,
  operator: "+" | "-" | "*" | "/" | "<" | ">" | "(" | ")",
): void {
  const nextToken = tokenizer.next();
  if (nextToken.kind !== "operator" || nextToken.text !== operator) {
    throw new TuffParseError(`Expected '${operator}'.`);
  }
}

function parseTypedValue(text: string, type: NumericType): TypedValue {
  if (isIntegerType(type)) {
    if (!/^-?\d+$/u.test(text)) {
      throw new TuffRuntimeError(
        `Value '${text}' is not a valid ${type} integer literal.`,
      );
    }

    const value = BigInt(text);
    const range = INTEGER_RANGES[type];
    if (value < range.min || value > range.max) {
      throw new TuffRuntimeError(
        `Value '${text}' is out of range for ${type}.`,
      );
    }

    return {
      kind: "int",
      type,
      value,
    };
  }

  if (!/^-?\d+(?:\.\d+)?$/u.test(text)) {
    throw new TuffRuntimeError(
      `Value '${text}' is not a valid ${type} floating-point literal.`,
    );
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new TuffRuntimeError(`Value '${text}' is not finite.`);
  }

  if (type === "F32" && Math.abs(value) > F32_MAX) {
    throw new TuffRuntimeError(`Value '${text}' is out of range for F32.`);
  }

  return {
    kind: "float",
    type,
    value,
  };
}

function readTokenValue(
  stdinTokens: string[],
  cursor: { index: number },
  type: NumericType,
): TypedValue {
  if (cursor.index >= stdinTokens.length) {
    throw new TuffRuntimeError(
      `stdin ended before a ${type} value could be read.`,
    );
  }

  const token = stdinTokens[cursor.index];
  cursor.index += 1;
  return parseTypedValue(token, type);
}

function evaluateExpression(
  expression: Expr,
  stdinTokens: string[],
  cursor: { index: number },
): TypedValue {
  switch (expression.kind) {
    case "literal":
      return parseTypedValue(expression.text, expression.type);
    case "read":
      return readTokenValue(stdinTokens, cursor, expression.type);
    case "unary": {
      const operand = evaluateExpression(
        expression.operand,
        stdinTokens,
        cursor,
      );
      return negateValue(operand);
    }
    case "binary": {
      const left = evaluateExpression(expression.left, stdinTokens, cursor);
      const right = evaluateExpression(expression.right, stdinTokens, cursor);
      return applyBinaryOperator(expression.operator, left, right);
    }
  }
}

function negateValue(value: TypedValue): TypedValue {
  if (value.kind === "int") {
    return normalizeIntegerResult(-value.value);
  }

  return makeFloatValue(value.type as FloatType, -value.value);
}

function applyBinaryOperator(
  operator: "+" | "-" | "*" | "/",
  left: TypedValue,
  right: TypedValue,
): TypedValue {
  if (left.kind === "float" || right.kind === "float") {
    const resultType = resolveFloatResultType(left.type, right.type);
    const leftValue = left.kind === "float" ? left.value : Number(left.value);
    const rightValue =
      right.kind === "float" ? right.value : Number(right.value);

    if (operator === "/" && rightValue === 0) {
      throw new TuffRuntimeError("Division by zero.");
    }

    let resultValue: number;
    switch (operator) {
      case "+":
        resultValue = leftValue + rightValue;
        break;
      case "-":
        resultValue = leftValue - rightValue;
        break;
      case "*":
        resultValue = leftValue * rightValue;
        break;
      case "/":
        resultValue = leftValue / rightValue;
        break;
    }

    return makeFloatValue(resultType, resultValue);
  }

  const leftValue = left.value as bigint;
  const rightValue = right.value as bigint;

  if (operator === "/" && rightValue === 0n) {
    throw new TuffRuntimeError("Division by zero.");
  }

  let resultValue: bigint;
  switch (operator) {
    case "+":
      resultValue = leftValue + rightValue;
      break;
    case "-":
      resultValue = leftValue - rightValue;
      break;
    case "*":
      resultValue = leftValue * rightValue;
      break;
    case "/":
      resultValue = leftValue / rightValue;
      break;
  }

  return normalizeIntegerResult(resultValue);
}

function resolveFloatResultType(
  leftType: NumericType,
  rightType: NumericType,
): FloatType {
  const leftFloatType = isFloatType(leftType) ? leftType : undefined;
  const rightFloatType = isFloatType(rightType) ? rightType : undefined;

  if (leftFloatType && rightFloatType) {
    return leftFloatType === "F64" || rightFloatType === "F64" ? "F64" : "F32";
  }

  return leftFloatType ?? rightFloatType ?? "F64";
}

function makeFloatValue(type: FloatType, value: number): TypedValue {
  if (!Number.isFinite(value)) {
    throw new TuffRuntimeError(
      "Floating-point arithmetic produced a non-finite value.",
    );
  }

  if (type === "F32" && Math.abs(value) > F32_MAX) {
    throw new TuffRuntimeError("Floating-point arithmetic overflowed F32.");
  }

  return {
    kind: "float",
    type,
    value,
  };
}

function normalizeIntegerResult(value: bigint): TypedValue {
  for (const type of INTEGER_TYPE_ORDER) {
    const range = INTEGER_RANGES[type];
    if (value >= range.min && value <= range.max) {
      return {
        kind: "int",
        type,
        value,
      };
    }
  }

  throw new TuffRuntimeError(
    `Integer arithmetic overflowed: ${value.toString()}`,
  );
}

function stdinToTokens(stdIn: string): string[] {
  const trimmed = stdIn.trim();
  if (trimmed === "") {
    return [];
  }

  return trimmed.split(/\s+/u);
}

function typedValueToNumber(value: TypedValue): number {
  return value.kind === "int" ? Number(value.value) : value.value;
}

function emitExpression(expression: Expr): string {
  switch (expression.kind) {
    case "literal":
      return `__tuffLiteral(${JSON.stringify(expression.text)}, ${JSON.stringify(
        expression.type,
      )})`;
    case "read":
      return `__tuffRead(${JSON.stringify(expression.type)})`;
    case "unary":
      return `__tuffNeg(${emitExpression(expression.operand)})`;
    case "binary":
      return `__tuffBinary(${JSON.stringify(expression.operator)}, ${emitExpression(
        expression.left,
      )}, ${emitExpression(expression.right)})`;
  }
}

export function compileTuffToTS(source: string): string {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "0;";
  }

  try {
    return `${emitExpression(parseProgram(trimmedSource))};`;
  } catch (error) {
    if (error instanceof TuffParseError) {
      return "0;";
    }

    throw error;
  }
}

/**
 * Compiles and executes a Tuff program, returning the numeric result.
 */
export function compileTuffAndExecute(tuffSource: string, stdIn = ""): number {
  const trimmedSource = tuffSource.trim();

  if (trimmedSource === "") {
    return 0;
  }

  let expression: Expr;
  try {
    expression = parseProgram(trimmedSource);
  } catch (error) {
    if (error instanceof TuffParseError) {
      return 0;
    }

    throw error;
  }

  const stdinTokens = stdinToTokens(stdIn);
  const cursor = { index: 0 };
  const value = evaluateExpression(expression, stdinTokens, cursor);
  return typedValueToNumber(value);
}
