console.log("Hello via Bun!");

export function interpretTuff(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") {
    return 0;
  }

  const typedSuffix = /^([+-]?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/i;
  const typedMatch = trimmed.match(typedSuffix);
  if (typedMatch) {
    const rawValue = Number(typedMatch[1]);
    const suffix = typedMatch[2]!.toUpperCase();

    const bounds: Record<string, [number, number]> = {
      U8: [0, 0xff],
      U16: [0, 0xffff],
      U32: [0, 0xffffffff],
      U64: [0, Number.MAX_SAFE_INTEGER],
      I8: [-0x80, 0x7f],
      I16: [-0x8000, 0x7fff],
      I32: [-0x80000000, 0x7fffffff],
      I64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    };

    const maybeBounds = bounds[suffix];
    if (!maybeBounds) {
      throw new Error(`Invalid Tuff input: ${input}`);
    }

    const [min, max] = maybeBounds;
    if (rawValue < min || rawValue > max) {
      throw new Error(`Invalid Tuff input: ${input}`);
    }
    return rawValue;
  }

  // Keep support for plain numeric values.
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid Tuff input: ${input}`);
  }

  return value;
}
