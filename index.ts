console.log("Hello via Bun!");

type TuffType =
  | "U8"
  | "U16"
  | "U32"
  | "U64"
  | "I8"
  | "I16"
  | "I32"
  | "I64"
  | null;

const bounds: Record<Exclude<TuffType, null>, [number, number]> = {
  U8: [0, 0xff],
  U16: [0, 0xffff],
  U32: [0, 0xffffffff],
  U64: [0, Number.MAX_SAFE_INTEGER],
  I8: [-0x80, 0x7f],
  I16: [-0x8000, 0x7fff],
  I32: [-0x80000000, 0x7fffffff],
  I64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
};

const unsignedOrder: Array<Exclude<TuffType, null>> = [
  "U8",
  "U16",
  "U32",
  "U64",
];
const signedOrder: Array<Exclude<TuffType, null>> = ["I8", "I16", "I32", "I64"];

function validateRange(value: number, type: TuffType, input: string): void {
  if (type === null) {
    return;
  }

  const [min, max] = bounds[type];
  if (value < min || value > max) {
    throw new Error(`Invalid Tuff input: ${input}`);
  }
}

function promoteType(a: TuffType, b: TuffType): TuffType {
  if (a === null) return b;
  if (b === null) return a;
  if (a === b) return a;

  if (a.startsWith("U") && b.startsWith("U")) {
    const result =
      unsignedOrder[
        Math.max(unsignedOrder.indexOf(a), unsignedOrder.indexOf(b))
      ];
    return result as Exclude<TuffType, null>;
  }

  if (a.startsWith("I") && b.startsWith("I")) {
    const result =
      signedOrder[Math.max(signedOrder.indexOf(a), signedOrder.indexOf(b))];
    return result as Exclude<TuffType, null>;
  }

  const aBounds = bounds[a];
  const bBounds = bounds[b];
  return aBounds[1] >= bBounds[1] ? a : b;
}

function evaluateTuff(input: string): { value: number; type: TuffType } {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { value: 0, type: null };
  }

  const typedSuffix = /^([+-]?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/i;
  const typedMatch = trimmed.match(typedSuffix);
  if (typedMatch) {
    const rawValue = Number(typedMatch[1]);
    const suffix = typedMatch[2]!.toUpperCase() as Exclude<TuffType, null>;

    validateRange(rawValue, suffix, input);
    return { value: rawValue, type: suffix };
  }

  const addExpr = /^(.+)\+(.+)$/;
  const addMatch = trimmed.match(addExpr);
  if (addMatch) {
    const left = evaluateTuff(addMatch[1]!.trim());
    const right = evaluateTuff(addMatch[2]!.trim());
    const resultValue = left.value + right.value;
    const resultType: TuffType = promoteType(left.type, right.type);

    validateRange(resultValue, resultType, input);

    return { value: resultValue, type: resultType };
  }

  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid Tuff input: ${input}`);
  }
  return { value, type: null };
}

export function interpretTuff(input: string): number {
  return evaluateTuff(input).value;
}
