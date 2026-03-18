const TYPE_RANGES: Record<string, { min: number; max: number }> = {
  U8: { min: 0, max: 255 },
  U16: { min: 0, max: 65535 },
  U32: { min: 0, max: 4294967295 },
  U64: { min: 0, max: 18446744073709551615 },
  I8: { min: -128, max: 127 },
  I16: { min: -32768, max: 32767 },
  I32: { min: -2147483648, max: 2147483647 },
  I64: { min: -9223372036854775808, max: 9223372036854775807 },
};

export function interpretTuff(input: string): number {
  if (input === "") {
    return 0;
  }

  // Reject negative numbers
  if (input.startsWith("-")) {
    throw new Error("Negative numbers are not allowed");
  }

  // Extract number and type suffix
  const match = input.match(/^(\d+)([A-Za-z]\w*)$/);
  if (!match) {
    throw new Error("Invalid format");
  }

  const [, numberStr, typeSuffix] = match;
  const value = parseInt(numberStr, 10);

  // Validate type suffix exists
  if (!TYPE_RANGES[typeSuffix]) {
    throw new Error(`Unknown type: ${typeSuffix}`);
  }

  // Validate range
  const range = TYPE_RANGES[typeSuffix];
  if (value < range.min || value > range.max) {
    throw new Error(
      `Value ${value} is out of range for type ${typeSuffix} (${range.min} to ${range.max})`,
    );
  }

  return value;
}
