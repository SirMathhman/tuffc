type IntSuffix = "U8" | "I8" | "U16" | "I16" | "U32" | "I32" | "U64" | "I64";

const INT_RANGES: Record<IntSuffix, [number, number]> = {
  U8: [0, 255],
  I8: [-128, 127],
  U16: [0, 65535],
  I16: [-32768, 32767],
  U32: [0, 2 ** 32 - 1],
  I32: [-(2 ** 31), 2 ** 31 - 1],
  U64: [0, 2 ** 64 - 1],
  I64: [-(2 ** 63), 2 ** 63 - 1],
};

const LITERAL_RE: RegExp =
  /^(-?\d+(?:\.\d+)?)(U8|I8|U16|I16|U32|I32|U64|I64)?$/;

const READ_RE: RegExp =
  /^read<(U8|I8|U16|I16|U32|I32|U64|I64)>\(\)$/;

const READ_CALL_RE: RegExp = /^read\b/;

export function compileTuffToTS(tuffSourceCode: string): string {
  const trimmed: string = tuffSourceCode.trim();
  if (trimmed === "") return "";

  // read<T>() built-in
  if (READ_CALL_RE.test(trimmed)) {
    const readMatch: RegExpMatchArray | null = trimmed.match(READ_RE);
    if (!readMatch) {
      throw new Error(`Syntax error: invalid read expression "${trimmed}"`);
    }
    return "return read();";
  }

  const match: RegExpMatchArray | null = trimmed.match(LITERAL_RE);
  if (!match) {
    throw new Error(`Syntax error: unexpected token "${trimmed}"`);
  }

  const rawNum: string = match[1]!;
  const rawSuffix: string | undefined = match[2];
  if (rawNum.includes(".")) {
    throw new Error(
      `Type error: non-integer value "${rawNum}" cannot have an integer type`,
    );
  }

  const suffix: IntSuffix = (rawSuffix ?? "I32") as IntSuffix;
  const value: number = parseInt(rawNum, 10);
  const [min, max]: [number, number] = INT_RANGES[suffix];

  if (value < min || value > max) {
    throw new Error(
      `Range error: ${rawNum} is out of range for ${suffix} (${min}..${max})`,
    );
  }

  return `return ${value};`;
}
