export function getGreeting(): string {
  return "Hello from TypeScript!";
}

export function interpretTuff(input: string): number {
  const match = /^(\d+|-(\d+))(U8|U16|U32|U64|I8|I16|I32|I64)$/.exec(input);

  if (!match) {
    throw new Error(`Unsupported Tuff input: ${input}`);
  }

  const rawValue = BigInt(match[1]);
  const suffix = match[3];

  const bounds: Record<string, readonly [bigint, bigint]> = {
    U8: [0n, 255n],
    U16: [0n, 65535n],
    U32: [0n, 4294967295n],
    U64: [0n, 18446744073709551615n],
    I8: [-128n, 127n],
    I16: [-32768n, 32767n],
    I32: [-2147483648n, 2147483647n],
    I64: [-9223372036854775808n, 9223372036854775807n],
  };

  const [min, max] = bounds[suffix];

  if (rawValue < min || rawValue > max) {
    throw new RangeError(`Tuff value out of bounds for ${suffix}: ${input}`);
  }

  return Number(rawValue);
}

export function main(): void {
  console.log(getGreeting());
}

if (require.main === module) {
  main();
}
