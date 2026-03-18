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

function parseLiteral(input: string): LiteralValueResult {
  const suffix = getSuffix(input);

  if (!suffix) {
    throw new Error(`Unsupported Tuff input: ${input}`);
  }

  const numericPart = input.slice(0, input.length - suffix.length);

  if (!isSignedIntegerText(numericPart)) {
    throw new Error(`Unsupported Tuff input: ${input}`);
  }

  const value = BigInt(numericPart);
  const type = getTuffType(suffix);

  enforceBounds(value, type, input);

  return { value, type };
}

function enforceBounds(value: bigint, type: TuffTypeInfo, input: string): void {
  if (value < type.min || value > type.max) {
    throw new RangeError(
      `Tuff value out of bounds for ${type.suffix}: ${input}`,
    );
  }
}

function getTuffType(suffix: TuffSuffix): TuffTypeInfo {
  const type = TUFF_TYPES.get(suffix);

  if (!type) {
    throw new Error(`Unsupported Tuff suffix: ${suffix}`);
  }

  return type;
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

function parseExpression(input: string): ExpressionParts | undefined {
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

    return { left, operator, right };
  }

  return undefined;
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
        return getTuffType("I8");
      case 16:
        return getTuffType("I16");
      case 32:
        return getTuffType("I32");
      default:
        return getTuffType("I64");
    }
  }

  switch (bits) {
    case 8:
      return getTuffType("U8");
    case 16:
      return getTuffType("U16");
    case 32:
      return getTuffType("U32");
    default:
      return getTuffType("U64");
  }
}

export function interpretTuff(input: string): number {
  const expressionMatch = parseExpression(input);

  if (!expressionMatch) {
    const { value } = parseLiteral(input);
    return Number(value);
  }

  const left = parseLiteral(expressionMatch.left);
  const operator = expressionMatch.operator;
  const right = parseLiteral(expressionMatch.right);
  const resultType = promoteType(left.type, right.type);

  let result: bigint;

  switch (operator) {
    case "+":
      result = left.value + right.value;
      break;
    case "-":
      result = left.value - right.value;
      break;
    case "*":
      result = left.value * right.value;
      break;
    case "/":
      if (right.value === 0n) {
        throw new RangeError(`Division by zero: ${input}`);
      }

      result = left.value / right.value;
      break;
    default:
      throw new Error(`Unsupported operator in Tuff input: ${input}`);
  }

  enforceBounds(result, resultType, input);

  return Number(result);
}

export function main(): void {
  console.log("Hello from TypeScript!");
}

if (require.main === module) {
  main();
}
