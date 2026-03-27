import * as ts from "typescript";

type NumericSuffix =
  | "U8"
  | "U16"
  | "U32"
  | "U64"
  | "I8"
  | "I16"
  | "I32"
  | "I64";

const SUFFIX_RANGES: Record<
  NumericSuffix,
  { min: bigint; max: bigint; bigint: boolean }
> = {
  U8: { min: 0n, max: 255n, bigint: false },
  U16: { min: 0n, max: 65535n, bigint: false },
  U32: { min: 0n, max: 4294967295n, bigint: false },
  U64: { min: 0n, max: 18446744073709551615n, bigint: true },
  I8: { min: -128n, max: 127n, bigint: false },
  I16: { min: -32768n, max: 32767n, bigint: false },
  I32: { min: -2147483648n, max: 2147483647n, bigint: false },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n, bigint: true },
};

function parseNumericSuffix(
  src: string,
): { value: bigint; suffix: NumericSuffix } | null {
  const m = new RegExp("^(-?\\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$").exec(
    src.trim(),
  );
  if (!m) return null;
  return { value: BigInt(m[1]), suffix: m[2] as NumericSuffix };
}

export function compileTuffToTS(tuffSourceCode: string): string {
  const parsed = parseNumericSuffix(tuffSourceCode);
  if (parsed) {
    const { value, suffix } = parsed;
    const range = SUFFIX_RANGES[suffix];
    if (value < range.min || value > range.max) {
      throw new Error(
        "Value " +
          String(value) +
          " is out of range for " +
          suffix +
          " (" +
          String(range.min) +
          ".." +
          String(range.max) +
          ")",
      );
    }
    const literal = range.bigint ? String(value) + "n" : String(value);
    const returnType = range.bigint ? "bigint" : "number";
    return "(function(): " + returnType + " { return " + literal + "; })()";
  }

  return "(function(): number { return " + tuffSourceCode + "; })()";
}

export function compileTSToJS(tsCode: string): string {
  const { outputText } = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  });
  return outputText;
}
