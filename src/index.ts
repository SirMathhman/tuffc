export function interpretTuff(input: string): number {
  if (input === "") {
    return 0;
  }

  const suffixMatch = input.match(/^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/);
  if (suffixMatch) {
    const value = BigInt(suffixMatch[1]);
    const suffix = suffixMatch[2];

    const limits: Record<string, { min: bigint; max: bigint }> = {
      U8: { min: 0n, max: 255n },
      U16: { min: 0n, max: 65535n },
      U32: { min: 0n, max: 4294967295n },
      U64: { min: 0n, max: 18446744073709551615n },
      I8: { min: -128n, max: 127n },
      I16: { min: -32768n, max: 32767n },
      I32: { min: -2147483648n, max: 2147483647n },
      I64: { min: -9223372036854775808n, max: 9223372036854775807n },
    };

    const { min, max } = limits[suffix];
    if (value < min || value > max) {
      throw new RangeError("Tuff integer literal out of range");
    }

    return Number(value);
  }

  const parsed = Number(input);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  throw new Error("Unsupported Tuff input");
}
