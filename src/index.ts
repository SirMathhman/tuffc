type TuffSuffix = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

interface TuffTypeInfo {
  suffix: TuffSuffix;
  signed: boolean;
  bits: 8 | 16 | 32 | 64;
  min: bigint;
  max: bigint;
}

interface LiteralValueResult {
  value: bigint;
  type: TuffTypeInfo;
}

interface ExpressionParts {
  left: string;
  operator: string;
  right: string;
}

interface OkResult<T> {
  ok: true;
  value: T;
}

interface ErrResult<E> {
  ok: false;
  error: E;
}

type Result<T, E> = OkResult<T> | ErrResult<E>;

interface TuffError {
  kind:
    | "UnsupportedInput"
    | "UnsupportedSuffix"
    | "OutOfBounds"
    | "DivisionByZero"
    | "UnsupportedOperator"
    | "UndefinedVariable";
  sourceCode: string;
  message: string;
  reason: string;
  suggestedFix: string;
}

interface BoundValue {
  value: bigint;
  type: TuffTypeInfo;
}

interface LetStatement {
  name: string;
  type: TuffTypeInfo;
  initializer: string;
}

const TUFF_TYPES = new Map<TuffSuffix, TuffTypeInfo>([
  ["U8", { suffix: "U8", signed: false, bits: 8, min: 0n, max: 255n }],
  ["U16", { suffix: "U16", signed: false, bits: 16, min: 0n, max: 65535n }],
  [
    "U32",
    { suffix: "U32", signed: false, bits: 32, min: 0n, max: 4294967295n },
  ],
  [
    "U64",
    {
      suffix: "U64",
      signed: false,
      bits: 64,
      min: 0n,
      max: 18446744073709551615n,
    },
  ],
  ["I8", { suffix: "I8", signed: true, bits: 8, min: -128n, max: 127n }],
  ["I16", { suffix: "I16", signed: true, bits: 16, min: -32768n, max: 32767n }],
  [
    "I32",
    {
      suffix: "I32",
      signed: true,
      bits: 32,
      min: -2147483648n,
      max: 2147483647n,
    },
  ],
  [
    "I64",
    {
      suffix: "I64",
      signed: true,
      bits: 64,
      min: -9223372036854775808n,
      max: 9223372036854775807n,
    },
  ],
]);

const TUFF_SUFFIXES: TuffSuffix[] = [
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
];

function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

function unsupportedInput(input: string): ErrResult<TuffError> {
  return err({
    kind: "UnsupportedInput",
    sourceCode: input,
    message: `Unsupported Tuff input: ${input}`,
    reason: "The input is not a supported literal or arithmetic expression.",
    suggestedFix:
      "Use a typed literal like 123U8 or an expression like 1U8 + 2U8.",
  });
}

function unsupportedSuffix(
  input: string,
  suffix: string,
): ErrResult<TuffError> {
  return err({
    kind: "UnsupportedSuffix",
    sourceCode: input,
    message: `Unsupported Tuff suffix: ${suffix}`,
    reason: "The literal suffix is not one of the supported Tuff families.",
    suggestedFix: "Use one of U8, U16, U32, U64, I8, I16, I32, or I64.",
  });
}

function outOfBounds(input: string, suffix: TuffSuffix): ErrResult<TuffError> {
  return err({
    kind: "OutOfBounds",
    sourceCode: input,
    message: `Tuff value out of bounds for ${suffix}: ${input}`,
    reason:
      "The numeric value is outside the allowed range for the target type.",
    suggestedFix: "Choose a value within the type bounds or use a wider type.",
  });
}

function divisionByZero(input: string): ErrResult<TuffError> {
  return err({
    kind: "DivisionByZero",
    sourceCode: input,
    message: `Division by zero: ${input}`,
    reason: "Division requires a non-zero right-hand operand.",
    suggestedFix: "Change the divisor to a non-zero typed literal.",
  });
}

function undefinedVariable(input: string, name: string): ErrResult<TuffError> {
  return err({
    kind: "UndefinedVariable",
    sourceCode: input,
    message: `Undefined variable: ${name}`,
    reason: "The variable was referenced before it was defined.",
    suggestedFix: `Define ${name} with a let binding before using it.`,
  });
}

function parseLiteral(input: string): Result<LiteralValueResult, TuffError> {
  const suffix = getSuffix(input);

  if (!suffix) {
    return unsupportedInput(input);
  }

  const numericPart = input.slice(0, input.length - suffix.length);

  if (!isSignedIntegerText(numericPart)) {
    return unsupportedInput(input);
  }

  const value = BigInt(numericPart);
  const type = TUFF_TYPES.get(suffix)!;

  if (value < type.min || value > type.max) {
    return outOfBounds(input, suffix);
  }

  return ok({ value, type });
}

function getSuffix(input: string): TuffSuffix | undefined {
  for (const suffix of TUFF_SUFFIXES) {
    if (input.endsWith(suffix)) {
      return suffix;
    }
  }

  return undefined;
}

function isSignedIntegerText(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  let startIndex = 0;

  if (text[0] === "-") {
    if (text.length === 1) {
      return false;
    }

    startIndex = 1;
  }

  for (let index = startIndex; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
}

function parseExpression(input: string): Result<ExpressionParts, TuffError> {
  for (let index = 1; index < input.length - 1; index += 1) {
    const operator = input[index];

    if (!isExpressionOperator(operator)) {
      continue;
    }

    const left = input.slice(0, index).trimEnd();
    const right = input.slice(index + 1).trimStart();

    return ok({ left, operator, right });
  }

  return unsupportedInput(input);
}

function parseLetStatement(input: string): Result<LetStatement, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("let")) {
    return unsupportedInput(input);
  }

  let index = 3;

  if (index >= trimmed.length || !isWhitespace(trimmed[index])) {
    return unsupportedInput(input);
  }

  index = skipWhitespace(trimmed, index);

  const nameStart = index;

  if (nameStart >= trimmed.length || !isIdentifierStart(trimmed[nameStart])) {
    return unsupportedInput(input);
  }

  index += 1;

  while (index < trimmed.length && isIdentifierPart(trimmed[index])) {
    index += 1;
  }

  const name = trimmed.slice(nameStart, index);
  index = skipWhitespace(trimmed, index);

  if (index >= trimmed.length || trimmed[index] !== ":") {
    return unsupportedInput(input);
  }

  index += 1;
  index = skipWhitespace(trimmed, index);

  const typeStart = index;

  while (
    index < trimmed.length &&
    !isWhitespace(trimmed[index]) &&
    trimmed[index] !== "="
  ) {
    index += 1;
  }

  const suffix = trimmed.slice(typeStart, index);

  if (suffix.length === 0) {
    return unsupportedInput(input);
  }

  const type = TUFF_TYPES.get(suffix as TuffSuffix);

  if (!type) {
    return unsupportedSuffix(input, suffix);
  }

  index = skipWhitespace(trimmed, index);

  if (index >= trimmed.length || trimmed[index] !== "=") {
    return unsupportedInput(input);
  }

  index += 1;

  const initializer = trimmed.slice(index).trim();

  if (initializer.length === 0) {
    return unsupportedInput(input);
  }

  return ok({ name, type, initializer });
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex;

  while (index < text.length && isWhitespace(text[index])) {
    index += 1;
  }

  return index;
}

function isWhitespace(value: string): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r";
}

function isIdentifierStart(value: string): boolean {
  const code = value.charCodeAt(0);

  return (
    code === 95 || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
  );
}

function isIdentifierPart(value: string): boolean {
  const code = value.charCodeAt(0);

  return isIdentifierStart(value) || (code >= 48 && code <= 57);
}

function isIdentifierText(text: string): boolean {
  if (text.length === 0 || !isIdentifierStart(text[0])) {
    return false;
  }

  for (let index = 1; index < text.length; index += 1) {
    if (!isIdentifierPart(text[index])) {
      return false;
    }
  }

  return true;
}

function splitStatements(input: string): string[] {
  const statements: string[] = [];
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === ";") {
      const trimmed = current.trim();

      if (trimmed.length > 0) {
        statements.push(trimmed);
      }

      current = "";
      continue;
    }

    current += character;
  }

  const trimmed = current.trim();

  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

function resolveIdentifier(
  name: string,
  sourceCode: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const value = environment.get(name);

  if (!value) {
    return undefinedVariable(sourceCode, name);
  }

  return ok(value);
}

function evaluateExpression(
  input: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const trimmed = input.trim();

  const literal = parseLiteral(trimmed);

  if (literal.ok) {
    return ok(literal.value);
  }

  const literalError = literal;

  if (isIdentifierText(trimmed)) {
    return resolveIdentifier(trimmed, input, environment);
  }

  const expression = parseExpression(trimmed);

  if (!expression.ok) {
    if (literalError.error.kind !== "UnsupportedInput") {
      return literalError;
    }

    return unsupportedInput(input);
  }

  const left = evaluateExpression(expression.value.left, environment);

  if (!left.ok) {
    return left;
  }

  const right = evaluateExpression(expression.value.right, environment);

  if (!right.ok) {
    return right;
  }

  const resultType = promoteType(left.value.type, right.value.type);
  const operator = expression.value.operator;

  let result = 0n;

  switch (operator as "+" | "-" | "*" | "/") {
    case "+":
      result = left.value.value + right.value.value;
      break;
    case "-":
      result = left.value.value - right.value.value;
      break;
    case "*":
      result = left.value.value * right.value.value;
      break;
    case "/":
      if (right.value.value === 0n) {
        return divisionByZero(input);
      }

      result = left.value.value / right.value.value;
      break;
  }

  if (result < resultType.min || result > resultType.max) {
    return outOfBounds(input, resultType.suffix);
  }

  return ok({ value: result, type: resultType });
}

function evaluateStatement(
  statement: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const letStatement = parseLetStatement(statement);

  if (!letStatement.ok) {
    return evaluateExpression(statement, environment);
  }

  const initializer = evaluateExpression(
    letStatement.value.initializer,
    environment,
  );

  if (!initializer.ok) {
    return initializer;
  }

  if (
    initializer.value.value < letStatement.value.type.min ||
    initializer.value.value > letStatement.value.type.max
  ) {
    return outOfBounds(statement, letStatement.value.type.suffix);
  }

  const boundValue: BoundValue = {
    value: initializer.value.value,
    type: letStatement.value.type,
  };

  environment.set(letStatement.value.name, boundValue);

  return ok(boundValue);
}

function isExpressionOperator(value: string): boolean {
  return value === "+" || value === "-" || value === "*" || value === "/";
}

function promoteType(left: TuffTypeInfo, right: TuffTypeInfo): TuffTypeInfo {
  const bits = Math.max(left.bits, right.bits) as 8 | 16 | 32 | 64;
  const signed = left.signed || right.signed;

  if (signed) {
    switch (bits) {
      case 8:
        return TUFF_TYPES.get("I8") as TuffTypeInfo;
      case 16:
        return TUFF_TYPES.get("I16") as TuffTypeInfo;
      case 32:
        return TUFF_TYPES.get("I32") as TuffTypeInfo;
      default:
        return TUFF_TYPES.get("I64") as TuffTypeInfo;
    }
  }

  switch (bits) {
    case 8:
      return TUFF_TYPES.get("U8") as TuffTypeInfo;
    case 16:
      return TUFF_TYPES.get("U16") as TuffTypeInfo;
    case 32:
      return TUFF_TYPES.get("U32") as TuffTypeInfo;
    default:
      return TUFF_TYPES.get("U64") as TuffTypeInfo;
  }
}

export function interpretTuff(input: string): Result<number, TuffError> {
  const statements = splitStatements(input);

  if (statements.length === 0) {
    return unsupportedInput(input);
  }

  const environment = new Map<string, BoundValue>();
  let lastValue: BoundValue | undefined;

  for (const statement of statements) {
    const evaluated = evaluateStatement(statement, environment);

    if (!evaluated.ok) {
      return evaluated;
    }

    lastValue = evaluated.value;
  }

  const finalValue = lastValue as BoundValue;

  return ok(Number(finalValue.value));
}

export function main(): void {
  console.log("Hello from TypeScript!");
}
