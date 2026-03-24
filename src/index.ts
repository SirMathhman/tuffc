export function interpretTuff(input: string): number {
  const unsignedMatch = input.match(/^(\d+)U(8|16|32|64)$/);
  if (unsignedMatch) {
    const value = BigInt(unsignedMatch[1]);
    const bitWidth = Number(unsignedMatch[2]);
    const maxValue = (1n << BigInt(bitWidth)) - 1n;
    if (value > maxValue) {
      throw new Error(`U${bitWidth} value out of range.`);
    }
    return Number(value);
  }

  const signedMatch = input.match(/^(-?\d+)I(8|16|32|64)$/);
  if (signedMatch) {
    const value = BigInt(signedMatch[1]);
    const bitWidth = Number(signedMatch[2]);
    const maxValue = (1n << (BigInt(bitWidth) - 1n)) - 1n;
    const minValue = -(1n << (BigInt(bitWidth) - 1n));
    if (value < minValue || value > maxValue) {
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
