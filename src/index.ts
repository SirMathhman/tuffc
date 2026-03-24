export function interpretTuff(input: string): number {
  const expressionMatch = input.match(/^(.+)\s*\+\s*(.+)$/);
  if (expressionMatch) {
    const left = parseTypedLiteral(expressionMatch[1].trim());
    const right = parseTypedLiteral(expressionMatch[2].trim());

    if (
      left &&
      right &&
      left.kind === right.kind &&
      left.bitWidth === right.bitWidth
    ) {
      const result = left.value + right.value;
      if (!isWithinTypedBounds(result, left.bitWidth, left.signed)) {
        throw new Error(
          `${left.signed ? "I" : "U"}${left.bitWidth} value out of range.`,
        );
      }

      return Number(result);
    }

    if (left && !right) {
      return addTypedAndPlain(left, expressionMatch[2].trim());
    }

    if (!left && right) {
      return addTypedAndPlain(right, expressionMatch[1].trim());
    }

    return (
      interpretTuff(expressionMatch[1]) + interpretTuff(expressionMatch[2])
    );
  }

  const unsignedMatch = input.match(/^(\d+)U(8|16|32|64)$/);
  if (unsignedMatch) {
    const value = BigInt(unsignedMatch[1]);
    const bitWidth = Number(unsignedMatch[2]);
    if (!isWithinTypedBounds(value, bitWidth, false)) {
      throw new Error(`U${bitWidth} value out of range.`);
    }
    return Number(value);
  }

  const signedMatch = input.match(/^(-?\d+)I(8|16|32|64)$/);
  if (signedMatch) {
    const value = BigInt(signedMatch[1]);
    const bitWidth = Number(signedMatch[2]);
    if (!isWithinTypedBounds(value, bitWidth, true)) {
      throw new Error(`I${bitWidth} value out of range.`);
    }
    return Number(value);
  }

  if (input.startsWith("-")) {
    throw new Error("Negative numbers are not supported.");
  }

  const match = input.match(/^\d+/);
  return match ? Number(match[0]) : 0;
}

function parseTypedLiteral(
  input: string,
):
  | { value: bigint; bitWidth: number; signed: boolean; kind: "U" | "I" }
  | undefined {
  const unsignedMatch = input.match(/^(\d+)U(8|16|32|64)$/);
  if (unsignedMatch) {
    return {
      value: BigInt(unsignedMatch[1]),
      bitWidth: Number(unsignedMatch[2]),
      signed: false,
      kind: "U",
    };
  }

  const signedMatch = input.match(/^(-?\d+)I(8|16|32|64)$/);
  if (signedMatch) {
    return {
      value: BigInt(signedMatch[1]),
      bitWidth: Number(signedMatch[2]),
      signed: true,
      kind: "I",
    };
  }

  return undefined;
}

function addTypedAndPlain(
  typed: { value: bigint; bitWidth: number; signed: boolean; kind: "U" | "I" },
  plainInput: string,
): number {
  const plainValue = BigInt(interpretTuff(plainInput));
  const result = typed.value + plainValue;

  if (!isWithinTypedBounds(result, typed.bitWidth, typed.signed)) {
    throw new Error(
      `${typed.signed ? "I" : "U"}${typed.bitWidth} value out of range.`,
    );
  }

  return Number(result);
}

function isWithinTypedBounds(
  value: bigint,
  bitWidth: number,
  signed: boolean,
): boolean {
  if (signed) {
    const maxValue = (1n << (BigInt(bitWidth) - 1n)) - 1n;
    const minValue = -(1n << (BigInt(bitWidth) - 1n));
    return value >= minValue && value <= maxValue;
  }

  const maxValue = (1n << BigInt(bitWidth)) - 1n;
  return value >= 0n && value <= maxValue;
}
