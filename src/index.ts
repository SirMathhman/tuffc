export function getGreeting(): string {
  return "Hello from TypeScript!";
}

type TuffSuffix = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

type TuffTypeInfo = {
  suffix: TuffSuffix;
  signed: boolean;
  bits: 8 | 16 | 32 | 64;
  min: bigint;
  max: bigint;
};

const TUFF_TYPES: Record<TuffSuffix, TuffTypeInfo> = {
  U8: { suffix: "U8", signed: false, bits: 8, min: 0n, max: 255n },
  U16: { suffix: "U16", signed: false, bits: 16, min: 0n, max: 65535n },
  U32: { suffix: "U32", signed: false, bits: 32, min: 0n, max: 4294967295n },
  U64: {
    suffix: "U64",
    signed: false,
    bits: 64,
    min: 0n,
    max: 18446744073709551615n,
  },
  I8: { suffix: "I8", signed: true, bits: 8, min: -128n, max: 127n },
  I16: { suffix: "I16", signed: true, bits: 16, min: -32768n, max: 32767n },
  I32: {
    suffix: "I32",
    signed: true,
    bits: 32,
    min: -2147483648n,
    max: 2147483647n,
  },
  I64: {
    suffix: "I64",
    signed: true,
    bits: 64,
    min: -9223372036854775808n,
    max: 9223372036854775807n,
  },
};

const LITERAL_PATTERN = /^(\d+|-(\d+))(U8|U16|U32|U64|I8|I16|I32|I64)$/;
const EXPRESSION_PATTERN = /^(.*\S)\s*([+\-*/])\s*(\S.*)$/;

function parseLiteral(input: string): { value: bigint; type: TuffTypeInfo } {
  const match = LITERAL_PATTERN.exec(input);

  if (!match) {
    throw new Error(`Unsupported Tuff input: ${input}`);
  }

  const value = BigInt(match[1]);
  const type = TUFF_TYPES[match[3] as TuffSuffix];

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

function promoteType(left: TuffTypeInfo, right: TuffTypeInfo): TuffTypeInfo {
  const bits = Math.max(left.bits, right.bits) as 8 | 16 | 32 | 64;
  const signed = left.signed || right.signed;

  if (signed) {
    switch (bits) {
      case 8:
        return TUFF_TYPES.I8;
      case 16:
        return TUFF_TYPES.I16;
      case 32:
        return TUFF_TYPES.I32;
      default:
        return TUFF_TYPES.I64;
    }
  }

  switch (bits) {
    case 8:
      return TUFF_TYPES.U8;
    case 16:
      return TUFF_TYPES.U16;
    case 32:
      return TUFF_TYPES.U32;
    default:
      return TUFF_TYPES.U64;
  }
}

export function interpretTuff(input: string): number {
  const expressionMatch = EXPRESSION_PATTERN.exec(input);

  if (!expressionMatch) {
    const { value, type } = parseLiteral(input);
    return Number(value);
  }

  const left = parseLiteral(expressionMatch[1]);
  const operator = expressionMatch[2];
  const right = parseLiteral(expressionMatch[3]);
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
  console.log(getGreeting());
}

if (require.main === module) {
  main();
}
