export function interpretTuff(input: string): number {
  const signedIMatch = input.match(/^(-\d+)I\d+$/);
  if (signedIMatch) {
    return Number(signedIMatch[1]);
  }

  const unsignedU8Match = input.match(/^(\d+)U8$/);
  if (unsignedU8Match) {
    const value = Number(unsignedU8Match[1]);
    if (value > 255) {
      throw new Error("U8 value out of range.");
    }
    return value;
  }

  if (input.startsWith("-")) {
    throw new Error("Negative numbers are not supported.");
  }

  const match = input.match(/^\d+/);
  return match ? Number(match[0]) : 0;
}
