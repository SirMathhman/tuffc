import vm from "node:vm";
import ts from "typescript";

type IntegerType = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";
type FloatType = "F32" | "F64";
type BoolType = "Bool";
type NumericType = IntegerType | FloatType;
type ValueType = NumericType | BoolType;
type ArithmeticBinaryOperator = "+" | "-" | "*" | "/";
type LogicalBinaryOperator = "&&" | "||";
type EqualityBinaryOperator = "==" | "!=";
type OrderingBinaryOperator = "<" | "<=" | ">" | ">=";
type BinaryOperator =
  | ArithmeticBinaryOperator
  | LogicalBinaryOperator
  | EqualityBinaryOperator
  | OrderingBinaryOperator;
type UnaryOperator = "-" | "!";
type OperatorText =
  | "+"
  | "-"
  | "*"
  | "/"
  | "!"
  | "=="
  | "!="
  | "&&"
  | "||"
  | "<"
  | "<="
  | ">"
  | ">="
  | "("
  | ")"
  | ":"
  | "="
  | ";";

type NumericValue = IntegerValue | FloatValue;
type BoolValue = {
  kind: "bool";
  type: BoolType;
  value: boolean;
};
type Value = NumericValue | BoolValue;

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

type Binding = {
  name: string;
  mutable: boolean;
  type: ValueType;
  initialized: boolean;
  value?: Value;
};

type Program = {
  kind: "program";
  statements: Statement[];
};

type Statement =
  | {
      kind: "let";
      name: string;
      mutable: boolean;
      declaredType?: ValueType;
      initializer?: Expr;
    }
  | {
      kind: "assign";
      name: string;
      expression: Expr;
    }
  | {
      kind: "expression";
      expression: Expr;
    };

type Expr =
  | { kind: "literal"; text: string; type: ValueType }
  | { kind: "read"; type: ValueType }
  | { kind: "variable"; name: string }
  | { kind: "unary"; operator: UnaryOperator; operand: Expr }
  | {
      kind: "binary";
      operator: BinaryOperator;
      left: Expr;
      right: Expr;
    };

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

type Token =
  | { kind: "number"; text: string }
  | { kind: "boolean"; text: "true" | "false" }
  | { kind: "type"; text: ValueType }
  | { kind: "ident"; text: string }
  | { kind: "keyword"; text: "let" | "mut" }
  | {
      kind: "operator";
      text: OperatorText;
    }
  | { kind: "eof" };

class Tokenizer {
  private readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  peek(offset = 0): Token {
    const savedIndex = this.index;
    let token: Token = { kind: "eof" };

    for (let i = 0; i <= offset; i += 1) {
      token = this.next();
    }

    this.index = savedIndex;
    return token;
  }

  next(): Token {
    this.skipWhitespace();

    if (this.index >= this.source.length) {
      return { kind: "eof" };
    }

    const currentChar = this.source[this.index];

    if (currentChar === "=" && this.source[this.index + 1] === "=") {
      this.index += 2;
      return { kind: "operator", text: "==" };
    }

    if (currentChar === "!" && this.source[this.index + 1] === "=") {
      this.index += 2;
      return { kind: "operator", text: "!=" };
    }

    if (currentChar === "<" && this.source[this.index + 1] === "=") {
      this.index += 2;
      return { kind: "operator", text: "<=" };
    }

    if (currentChar === ">" && this.source[this.index + 1] === "=") {
      this.index += 2;
      return { kind: "operator", text: ">=" };
    }

    if (currentChar === "&") {
      if (this.source[this.index + 1] === "&") {
        this.index += 2;
        return { kind: "operator", text: "&&" };
      }

      this.throwUnexpectedCharacter(currentChar);
    }

    if (currentChar === "|") {
      if (this.source[this.index + 1] === "|") {
        this.index += 2;
        return { kind: "operator", text: "||" };
      }

      this.throwUnexpectedCharacter(currentChar);
    }

    if (this.isOperator(currentChar)) {
      this.index += 1;
      return {
        kind: "operator",
        text: currentChar as OperatorText,
      };
    }

    if (this.isDigit(currentChar)) {
      const start = this.index;
      this.consumeDigits();

      if (this.index < this.source.length && this.source[this.index] === ".") {
        this.index += 1;
        this.consumeDigits();
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
      if (text === "let" || text === "mut") {
        return { kind: "keyword", text };
      }

      if (text === "true" || text === "false") {
        return { kind: "boolean", text };
      }

      if (isValueType(text)) {
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

  private isOperator(character: string): boolean {
    return (
      character === "+" ||
      character === "-" ||
      character === "*" ||
      character === "/" ||
      character === "!" ||
      character === "&" ||
      character === "|" ||
      character === "<" ||
      character === ">" ||
      character === "(" ||
      character === ")" ||
      character === ":" ||
      character === "=" ||
      character === ";"
    );
  }

  private consumeDigits(): void {
    while (
      this.index < this.source.length &&
      this.isDigit(this.source[this.index])
    ) {
      this.index += 1;
    }
  }

  private throwUnexpectedCharacter(character: string): never {
    throw new TuffParseError(
      `Unexpected character '${character}' at position ${this.index + 1}.`,
    );
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

function isBoolType(type: string): type is BoolType {
  return type === "Bool";
}

function isValueType(type: string): type is ValueType {
  return isNumericType(type) || isBoolType(type);
}

function isFloatType(type: NumericType): type is FloatType {
  return type === "F32" || type === "F64";
}

function isIntegerType(type: NumericType): type is IntegerType {
  return !isFloatType(type);
}

function parseProgram(source: string): Program {
  const tokenizer = new Tokenizer(source);
  const statements: Statement[] = [];

  while (true) {
    const nextToken = tokenizer.peek();
    if (nextToken.kind === "eof") {
      break;
    }

    statements.push(parseStatement(tokenizer));

    const delimiter = tokenizer.peek();
    if (delimiter.kind === "operator" && delimiter.text === ";") {
      tokenizer.next();
      continue;
    }

    if (delimiter.kind === "eof") {
      break;
    }

    throw new TuffParseError("Expected ';' between statements.");
  }

  return {
    kind: "program",
    statements,
  };
}

function parseStatement(tokenizer: Tokenizer): Statement {
  const nextToken = tokenizer.peek();

  if (nextToken.kind === "keyword" && nextToken.text === "let") {
    tokenizer.next();
    return parseLetStatement(tokenizer);
  }

  if (
    nextToken.kind === "ident" &&
    (() => {
      const secondToken = tokenizer.peek(1);
      return secondToken.kind === "operator" && secondToken.text === "=";
    })()
  ) {
    const nameToken = tokenizer.next();
    tokenizer.next();
    if (nameToken.kind !== "ident") {
      throw new TuffParseError("Assignment requires an identifier name.");
    }
    return {
      kind: "assign",
      name: nameToken.text,
      expression: parseExpression(tokenizer),
    };
  }

  return {
    kind: "expression",
    expression: parseExpression(tokenizer),
  };
}

function parseLetStatement(tokenizer: Tokenizer): Statement {
  let mutable = false;
  const maybeMut = tokenizer.peek();
  if (maybeMut.kind === "keyword" && maybeMut.text === "mut") {
    tokenizer.next();
    mutable = true;
  }

  const nameToken = tokenizer.next();
  if (nameToken.kind !== "ident") {
    throw new TuffParseError("let requires an identifier name.");
  }

  let declaredType: ValueType | undefined;
  const maybeColon = tokenizer.peek();
  if (maybeColon.kind === "operator" && maybeColon.text === ":") {
    tokenizer.next();
    const typeToken = tokenizer.next();
    if (typeToken.kind !== "type") {
      throw new TuffParseError("let type annotations must use a valid type.");
    }
    declaredType = typeToken.text;
  }

  let initializer: Expr | undefined;
  const maybeEquals = tokenizer.peek();
  if (maybeEquals.kind === "operator" && maybeEquals.text === "=") {
    tokenizer.next();
    initializer = parseExpression(tokenizer);
  }

  if (!declaredType && !initializer) {
    throw new TuffParseError(
      "let declarations require a type annotation or an initializer.",
    );
  }

  return {
    kind: "let",
    name: nameToken.text,
    mutable,
    declaredType,
    initializer,
  };
}

function parseExpression(tokenizer: Tokenizer): Expr {
  return parseLogicalOr(tokenizer);
}

function parseLogicalOr(tokenizer: Tokenizer): Expr {
  let expression = parseLogicalAnd(tokenizer);

  while (true) {
    const nextToken = tokenizer.peek();
    if (nextToken.kind !== "operator" || nextToken.text !== "||") {
      return expression;
    }

    tokenizer.next();
    const right = parseLogicalAnd(tokenizer);
    expression = {
      kind: "binary",
      operator: nextToken.text,
      left: expression,
      right,
    };
  }
}

function parseLogicalAnd(tokenizer: Tokenizer): Expr {
  let expression = parseEquality(tokenizer);

  while (true) {
    const nextToken = tokenizer.peek();
    if (nextToken.kind !== "operator" || nextToken.text !== "&&") {
      return expression;
    }

    tokenizer.next();
    const right = parseEquality(tokenizer);
    expression = {
      kind: "binary",
      operator: nextToken.text,
      left: expression,
      right,
    };
  }
}

function parseEquality(tokenizer: Tokenizer): Expr {
  let expression = parseComparison(tokenizer);

  while (true) {
    const nextToken = tokenizer.peek();
    if (
      nextToken.kind !== "operator" ||
      (nextToken.text !== "==" && nextToken.text !== "!=")
    ) {
      return expression;
    }

    tokenizer.next();
    const right = parseComparison(tokenizer);
    expression = {
      kind: "binary",
      operator: nextToken.text,
      left: expression,
      right,
    };
  }
}

function parseComparison(tokenizer: Tokenizer): Expr {
  const left = parseAdditive(tokenizer);
  const nextToken = tokenizer.peek();
  if (
    nextToken.kind !== "operator" ||
    (nextToken.text !== "<" &&
      nextToken.text !== "<=" &&
      nextToken.text !== ">" &&
      nextToken.text !== ">=")
  ) {
    return left;
  }

  tokenizer.next();
  const right = parseAdditive(tokenizer);
  const expression: Expr = {
    kind: "binary",
    operator: nextToken.text,
    left,
    right,
  };

  const maybeChained = tokenizer.peek();
  if (
    maybeChained.kind === "operator" &&
    (maybeChained.text === "<" ||
      maybeChained.text === "<=" ||
      maybeChained.text === ">" ||
      maybeChained.text === ">=")
  ) {
    throw new TuffParseError("Chained comparisons are not supported.");
  }

  return expression;
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
  if (
    nextToken.kind === "operator" &&
    (nextToken.text === "-" || nextToken.text === "!")
  ) {
    tokenizer.next();
    const operand = parseUnary(tokenizer);

    if (operand.kind === "literal") {
      return foldUnaryLiteralExpression(nextToken.text, operand);
    }

    return {
      kind: "unary",
      operator: nextToken.text,
      operand,
    };
  }

  return parsePrimary(tokenizer);
}

function foldUnaryLiteralExpression(
  operator: UnaryOperator,
  literal: Extract<Expr, { kind: "literal" }>,
): Expr {
  if (operator === "!") {
    if (!isBoolType(literal.type)) {
      throw new TuffRuntimeError("Boolean values cannot be negated.");
    }

    return {
      kind: "literal",
      text: literal.text === "true" ? "false" : "true",
      type: "Bool",
    };
  }

  if (!isNumericType(literal.type)) {
    throw new TuffRuntimeError("Boolean values cannot be negated.");
  }

  if (isIntegerType(literal.type) && literal.type.startsWith("U")) {
    throw new TuffRuntimeError(
      `Negative literals are not allowed for unsigned type ${literal.type}.`,
    );
  }

  return {
    kind: "literal",
    text: `-${literal.text}`,
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

  if (nextToken.kind === "boolean") {
    return {
      kind: "literal",
      text: nextToken.text,
      type: "Bool",
    };
  }

  if (nextToken.kind === "ident" && nextToken.text === "read") {
    expectOperator(tokenizer, "<");
    const typeToken = tokenizer.next();
    if (typeToken.kind !== "type") {
      throw new TuffParseError("read<T>() requires a valid type parameter.");
    }
    expectOperator(tokenizer, ">");
    expectOperator(tokenizer, "(");
    expectOperator(tokenizer, ")");

    return {
      kind: "read",
      type: typeToken.text,
    };
  }

  if (nextToken.kind === "ident") {
    return {
      kind: "variable",
      name: nextToken.text,
    };
  }

  if (nextToken.kind === "operator" && nextToken.text === "(") {
    const expression = parseExpression(tokenizer);
    expectOperator(tokenizer, ")");
    return expression;
  }

  throw new TuffParseError(
    "Expected a numeric literal, read<T>(), variable, or grouped expression.",
  );
}

function expectOperator(
  tokenizer: Tokenizer,
  operator: "+" | "-" | "*" | "/" | "<" | ">" | "(" | ")" | ":" | "=" | ";",
): void {
  const nextToken = tokenizer.next();
  if (nextToken.kind !== "operator" || nextToken.text !== operator) {
    throw new TuffParseError(`Expected '${operator}'.`);
  }
}

function parseTypedValue(text: string, type: ValueType): Value {
  if (isBoolType(type)) {
    return parseBoolValue(text);
  }

  if (isIntegerType(type)) {
    return parseIntegerValue(text, type);
  }

  return parseFloatValue(text, type);
}

function parseBoolValue(text: string): BoolValue {
  switch (text) {
    case "true":
      return {
        kind: "bool",
        type: "Bool",
        value: true,
      };
    case "false":
      return {
        kind: "bool",
        type: "Bool",
        value: false,
      };
    default:
      throw new TuffRuntimeError(
        `Value '${text}' is not a valid Bool boolean literal.`,
      );
  }
}

function parseIntegerValue(text: string, type: IntegerType): IntegerValue {
  ensureLiteralMatches(text, /^-?\d+$/u, type, "integer");

  const value = BigInt(text);
  ensureIntegerInRange(text, type, value);

  return {
    kind: "int",
    type,
    value,
  };
}

function parseFloatValue(text: string, type: FloatType): FloatValue {
  ensureLiteralMatches(text, /^-?\d+(?:\.\d+)?$/u, type, "floating-point");

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new TuffRuntimeError(`Value '${text}' is not finite.`);
  }

  ensureF32Range(text, type, value);

  return {
    kind: "float",
    type,
    value,
  };
}

function ensureLiteralMatches(
  text: string,
  pattern: RegExp,
  type: ValueType,
  literalKind: string,
): void {
  if (!pattern.test(text)) {
    throw new TuffRuntimeError(
      `Value '${text}' is not a valid ${type} ${literalKind} literal.`,
    );
  }
}

function ensureIntegerInRange(
  text: string,
  type: IntegerType,
  value: bigint,
): void {
  const range = INTEGER_RANGES[type];
  if (value < range.min || value > range.max) {
    throwOutOfRange(text, type);
  }
}

function ensureF32Range(text: string, type: ValueType, value: number): void {
  if (type === "F32" && Math.abs(value) > F32_MAX) {
    throwOutOfRange(text, "F32");
  }
}

function throwOutOfRange(text: string, type: ValueType): never {
  throw new TuffRuntimeError(`Value '${text}' is out of range for ${type}.`);
}

function coerceValueToType(value: Value, targetType: ValueType): Value {
  if (isBoolType(targetType)) {
    if (value.kind !== "bool") {
      throw new TuffRuntimeError("Numeric values cannot be assigned to Bool.");
    }

    return {
      kind: "bool",
      type: targetType,
      value: value.value,
    };
  }

  if (value.kind === "bool") {
    throw new TuffRuntimeError(
      `Boolean value cannot be assigned to numeric type ${targetType}.`,
    );
  }

  if (isIntegerType(targetType)) {
    if (value.kind !== "int") {
      throw new TuffRuntimeError(
        `Float value cannot be assigned to integer type ${targetType}.`,
      );
    }

    const range = INTEGER_RANGES[targetType];
    if (value.value < range.min || value.value > range.max) {
      throw new TuffRuntimeError(
        `Value '${value.value.toString()}' is out of range for ${targetType}.`,
      );
    }

    return {
      kind: "int",
      type: targetType,
      value: value.value,
    };
  }

  const numericValue = value.kind === "int" ? Number(value.value) : value.value;
  if (!Number.isFinite(numericValue)) {
    throw new TuffRuntimeError(
      `Value '${numericValue.toString()}' is not finite.`,
    );
  }

  ensureF32Range(numericValue.toString(), targetType, numericValue);

  return {
    kind: "float",
    type: targetType,
    value: numericValue,
  };
}

function readTypedValue(read: () => string, type: ValueType): Value {
  return parseTypedValue(read(), type);
}

function resolveBinding(env: Binding[], name: string): Binding {
  for (let index = env.length - 1; index >= 0; index -= 1) {
    if (env[index].name === name) {
      return env[index];
    }
  }

  throw new TuffRuntimeError(`Unknown variable '${name}'.`);
}

function evaluateProgram(program: Program, read: () => string): Value {
  const env: Binding[] = [];
  let lastValue: Value | null = null;

  for (const statement of program.statements) {
    const statementValue = evaluateStatement(statement, env, read);
    if (statementValue !== null) {
      lastValue = statementValue;
    }
  }

  return (
    lastValue ?? {
      kind: "int",
      type: "U8",
      value: 0n,
    }
  );
}

function evaluateStatement(
  statement: Statement,
  env: Binding[],
  read: () => string,
): Value | null {
  switch (statement.kind) {
    case "let": {
      const binding: Binding = {
        name: statement.name,
        mutable: statement.mutable,
        type: statement.declaredType ?? "U8",
        initialized: false,
      };

      if (statement.initializer) {
        const initializerValue = evaluateExpression(
          statement.initializer,
          env,
          read,
        );
        const assignedValue = coerceValueToType(
          initializerValue,
          statement.declaredType ?? initializerValue.type,
        );
        binding.type = assignedValue.type;
        binding.value = assignedValue;
        binding.initialized = true;
        env.push(binding);
        return assignedValue;
      }

      if (!statement.declaredType) {
        throw new TuffRuntimeError(
          `let ${statement.name} requires a type annotation when no initializer is present.`,
        );
      }

      env.push(binding);
      return null;
    }
    case "assign": {
      const binding = resolveBinding(env, statement.name);
      if (!binding.mutable) {
        throw new TuffRuntimeError(
          `Variable '${statement.name}' is immutable.`,
        );
      }

      const assignedValue = coerceValueToType(
        evaluateExpression(statement.expression, env, read),
        binding.type,
      );
      binding.value = assignedValue;
      binding.initialized = true;
      return assignedValue;
    }
    case "expression":
      return evaluateExpression(statement.expression, env, read);
  }
}

function evaluateExpression(
  expression: Expr,
  env: Binding[],
  read: () => string,
): Value {
  switch (expression.kind) {
    case "literal":
      return parseTypedValue(expression.text, expression.type);
    case "read":
      return readTypedValue(read, expression.type);
    case "variable": {
      const binding = resolveBinding(env, expression.name);
      if (!binding.initialized || !binding.value) {
        throw new TuffRuntimeError(
          `Variable '${expression.name}' is used before it is initialized.`,
        );
      }

      return binding.value;
    }
    case "unary": {
      const operand = evaluateExpression(expression.operand, env, read);
      return applyUnaryOperator(expression.operator, operand);
    }
    case "binary": {
      return evaluateBinaryExpression(expression, env, read);
    }
  }
}

function applyUnaryOperator(operator: UnaryOperator, operand: Value): Value {
  switch (operator) {
    case "-":
      if (operand.kind === "bool") {
        throw new TuffRuntimeError("Boolean values cannot be negated.");
      }
      return negateValue(operand);
    case "!":
      return invertBooleanValue(operand);
  }
}

function invertBooleanValue(value: Value): BoolValue {
  if (value.kind !== "bool") {
    throw new TuffRuntimeError("Boolean values cannot be negated.");
  }

  return {
    kind: "bool",
    type: "Bool",
    value: !value.value,
  };
}

function evaluateBinaryExpression(
  expression: Extract<Expr, { kind: "binary" }>,
  env: Binding[],
  read: () => string,
): Value {
  switch (expression.operator) {
    case "&&":
    case "||":
      return evaluateLogicalBinaryExpression(expression, env, read);
    case "==":
    case "!=":
      return evaluateEqualityBinaryExpression(expression, env, read);
    case "<":
    case "<=":
    case ">":
    case ">=":
      return evaluateOrderingBinaryExpression(expression, env, read);
    default: {
      const left = evaluateExpression(expression.left, env, read);
      const right = evaluateExpression(expression.right, env, read);
      return applyBinaryOperator(expression.operator, left, right);
    }
  }
}

function evaluateLogicalBinaryExpression(
  expression: Extract<Expr, { kind: "binary" }>,
  env: Binding[],
  read: () => string,
): BoolValue {
  const left = requireBoolValue(
    evaluateExpression(expression.left, env, read),
    expression.operator,
  );

  const shortCircuitValue = expression.operator === "&&" ? false : true;
  if (left.value === shortCircuitValue) {
    return left;
  }

  return requireBoolValue(
    evaluateExpression(expression.right, env, read),
    expression.operator,
  );
}

function evaluateEqualityBinaryExpression(
  expression: Extract<Expr, { kind: "binary" }>,
  env: Binding[],
  read: () => string,
): BoolValue {
  const left = evaluateExpression(expression.left, env, read);
  const right = evaluateExpression(expression.right, env, read);

  if (left.kind === "bool" && right.kind === "bool") {
    const equals = left.value === right.value;
    return {
      kind: "bool",
      type: "Bool",
      value: expression.operator === "==" ? equals : !equals,
    };
  }

  if (left.kind === "bool" || right.kind === "bool") {
    throw new TuffRuntimeError(
      `Equality operator '${expression.operator}' requires both operands to be Bool or both numeric.`,
    );
  }

  const equals = compareNumericValues(left, right) === 0;
  return {
    kind: "bool",
    type: "Bool",
    value: expression.operator === "==" ? equals : !equals,
  };
}

function evaluateOrderingBinaryExpression(
  expression: Extract<Expr, { kind: "binary" }>,
  env: Binding[],
  read: () => string,
): BoolValue {
  const left = requireNumericValue(
    evaluateExpression(expression.left, env, read),
    expression.operator,
  );
  const right = requireNumericValue(
    evaluateExpression(expression.right, env, read),
    expression.operator,
  );

  const comparison = compareNumericValues(left, right);
  const value = evaluateComparisonResult(
    expression.operator as OrderingBinaryOperator,
    comparison,
  );

  return {
    kind: "bool",
    type: "Bool",
    value,
  };
}

function compareNumericValues(left: NumericValue, right: NumericValue): number {
  if (left.kind === "int" && right.kind === "int") {
    if (left.value < right.value) {
      return -1;
    }

    if (left.value > right.value) {
      return 1;
    }

    return 0;
  }

  const leftValue = numericToNumber(left);
  const rightValue = numericToNumber(right);

  if (leftValue < rightValue) {
    return -1;
  }

  if (leftValue > rightValue) {
    return 1;
  }

  return 0;
}

function evaluateComparisonResult(
  operator: OrderingBinaryOperator,
  comparison: number,
): boolean {
  switch (operator) {
    case "<":
      return comparison < 0;
    case "<=":
      return comparison <= 0;
    case ">":
      return comparison > 0;
    case ">=":
      return comparison >= 0;
  }
}

function requireNumericValue(value: Value, operator: string): NumericValue {
  if (value.kind === "bool") {
    throw new TuffRuntimeError(
      `Comparison operator '${operator}' requires numeric operands.`,
    );
  }

  return value;
}

function numericToNumber(value: NumericValue): number {
  return value.kind === "float" ? value.value : Number(value.value);
}

function requireBoolValue(value: Value, operator: string): BoolValue {
  if (value.kind !== "bool") {
    throw new TuffRuntimeError(
      `Boolean operator '${operator}' requires Bool operands.`,
    );
  }

  return value;
}

function negateValue(value: NumericValue): NumericValue {
  if (value.kind === "int") {
    return normalizeIntegerResult(-value.value);
  }

  return makeFloatValue(value.type, -value.value);
}

function applyBinaryOperator(
  operator: "+" | "-" | "*" | "/",
  left: Value,
  right: Value,
): NumericValue {
  if (left.kind === "bool" || right.kind === "bool") {
    throw new TuffRuntimeError("Boolean values cannot be used in arithmetic.");
  }

  if (left.kind === "float" || right.kind === "float") {
    const resultType = resolveFloatResultType(left.type, right.type);
    const leftValue = numericToNumber(left);
    const rightValue = numericToNumber(right);

    return applyArithmeticValue(
      operator,
      leftValue,
      rightValue,
      0,
      (resultValue) => makeFloatValue(resultType, resultValue),
    );
  }

  const leftValue = left.value;
  const rightValue = right.value;

  return applyArithmeticValue(
    operator,
    leftValue,
    rightValue,
    0n,
    normalizeIntegerResult,
  );
}

function applyArithmeticValue<T extends number | bigint>(
  operator: "+" | "-" | "*" | "/",
  leftValue: T,
  rightValue: T,
  zeroValue: T,
  convert: (value: T) => NumericValue,
): NumericValue {
  if (operator === "/" && rightValue === zeroValue) {
    throw new TuffRuntimeError("Division by zero.");
  }

  if (typeof zeroValue === "bigint") {
    const resultValue = applyArithmeticOperator(
      operator,
      leftValue as bigint,
      rightValue as bigint,
      (left, right) => left + right,
      (left, right) => left - right,
      (left, right) => left * right,
      (left, right) => left / right,
    );

    return convert(resultValue as T);
  }

  let resultValue: number;
  switch (operator) {
    case "+":
      resultValue = (leftValue as number) + (rightValue as number);
      break;
    case "-":
      resultValue = (leftValue as number) - (rightValue as number);
      break;
    case "*":
      resultValue = (leftValue as number) * (rightValue as number);
      break;
    case "/":
      resultValue = (leftValue as number) / (rightValue as number);
      break;
  }

  return convert(resultValue as T);
}

function applyArithmeticOperator<T extends number | bigint>(
  operator: "+" | "-" | "*" | "/",
  leftValue: T,
  rightValue: T,
  add: (left: T, right: T) => T,
  subtract: (left: T, right: T) => T,
  multiply: (left: T, right: T) => T,
  divide: (left: T, right: T) => T,
): T {
  switch (operator) {
    case "+":
      return add(leftValue, rightValue);
    case "-":
      return subtract(leftValue, rightValue);
    case "*":
      return multiply(leftValue, rightValue);
    case "/":
      return divide(leftValue, rightValue);
  }
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

function makeFloatValue(type: FloatType, value: number): FloatValue {
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

function normalizeIntegerResult(value: bigint): NumericValue {
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

function executeProgramWithRead(program: Program, read: () => string): number {
  const result = evaluateProgram(program, read);
  if (result.kind === "bool") {
    return result.value ? 1 : 0;
  }

  return result.kind === "int" ? Number(result.value) : result.value;
}

export function compileTuffToTS(source: string): string {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "0;";
  }

  const program = parseProgram(trimmedSource);
  return `__tuffEval(${JSON.stringify(program)}, read);`;
}

/**
 * Compiles and executes a Tuff program, returning the numeric result.
 */
export function compileTuffAndExecute(tuffSource: string, stdIn = ""): number {
  const tsSource = compileTuffToTS(tuffSource);
  const transpileResult = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  if (transpileResult.diagnostics?.length) {
    const diagnosticMessage = ts.formatDiagnosticsWithColorAndContext(
      transpileResult.diagnostics,
      {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
      },
    );

    throw new Error(`TypeScript transpilation failed:\n${diagnosticMessage}`);
  }

  const stdinTokens = stdinToTokens(stdIn);
  let stdinIndex = 0;
  const read = () => {
    if (stdinIndex >= stdinTokens.length) {
      throw new TuffRuntimeError(
        "Provided stdin ran out of whitespace-separated tokens.",
      );
    }

    const token = stdinTokens[stdinIndex];
    stdinIndex += 1;
    return token;
  };

  const script = new vm.Script(transpileResult.outputText, {
    filename: "generated.js",
  });

  const result = script.runInNewContext({
    console,
    setTimeout,
    clearTimeout,
    read,
    __tuffEval: executeProgramWithRead,
  });

  if (typeof result !== "number") {
    throw new Error("Executed JavaScript did not return a number.");
  }

  return result;
}
