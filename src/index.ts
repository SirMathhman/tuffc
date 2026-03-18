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
    | "UnsupportedOperator";
  sourceCode: string;
  message: string;
  reason: string;
  suggestedFix: string;
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

function unsupportedOperator(input: string): ErrResult<TuffError> {
  return err({
    kind: "UnsupportedOperator",
    sourceCode: input,
    message: `Unsupported operator in Tuff input: ${input}`,
    reason: "Only +, -, *, and / are supported.",
    suggestedFix: "Use one of the supported arithmetic operators.",
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
  const type = TUFF_TYPES.get(suffix);

  if (!type) {
    return unsupportedSuffix(input, suffix);
  }

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

    if (left.length === 0 || right.length === 0) {
      continue;
    }

    return ok({ left, operator, right });
  }

  return unsupportedInput(input);
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
  const expressionMatch = parseExpression(input);

  if (!expressionMatch.ok) {
    const literal = parseLiteral(input);

    if (!literal.ok) {
      return literal;
    }

    return ok(Number(literal.value.value));
  }

  const left = parseLiteral(expressionMatch.value.left);

  if (!left.ok) {
    return left;
  }

  const right = parseLiteral(expressionMatch.value.right);

  if (!right.ok) {
    return right;
  }

  const resultType = promoteType(left.value.type, right.value.type);
  const operator = expressionMatch.value.operator;

  let result: bigint;

  switch (operator) {
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
    default:
      return unsupportedOperator(input);
  }

  if (result < resultType.min || result > resultType.max) {
    return outOfBounds(input, resultType.suffix);
  }

  return ok(Number(result));
}

export function main(): void {
  console.log("Hello from TypeScript!");
}

if (require.main === module) {
  main();
}
