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

interface SuffixRange {
  min: bigint;
  max: bigint;
  bigint: boolean;
}

interface ParsedSuffix {
  value: bigint;
  suffix: NumericSuffix;
}

export interface Ok<T> {
  ok: true;
  value: T;
}

export interface Err<E> {
  ok: false;
  error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

const SUFFIX_RANGES: Record<NumericSuffix, SuffixRange> = {
  U8: { min: 0n, max: 255n, bigint: false },
  U16: { min: 0n, max: 65535n, bigint: false },
  U32: { min: 0n, max: 4294967295n, bigint: false },
  U64: { min: 0n, max: 18446744073709551615n, bigint: true },
  I8: { min: -128n, max: 127n, bigint: false },
  I16: { min: -32768n, max: 32767n, bigint: false },
  I32: { min: -2147483648n, max: 2147483647n, bigint: false },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n, bigint: true },
};

const NUMERIC_SUFFIXES: NumericSuffix[] = [
  "U64",
  "I64",
  "U32",
  "U16",
  "U8",
  "I32",
  "I16",
  "I8",
];

function parseNumericSuffix(src: string): ParsedSuffix | undefined {
  const trimmed = src.trim();
  for (const suffix of NUMERIC_SUFFIXES) {
    if (!trimmed.endsWith(suffix)) continue;
    const numPart = trimmed.slice(0, trimmed.length - suffix.length);
    if (numPart.length === 0) continue;
    const isValid =
      (numPart[0] === "-" || (numPart[0] >= "0" && numPart[0] <= "9")) &&
      numPart
        .slice(numPart[0] === "-" ? 1 : 0)
        .split("")
        .every((c) => c >= "0" && c <= "9");
    if (!isValid || numPart === "-") continue;
    return { value: BigInt(numPart), suffix };
  }
  return undefined;
}

export function compileTuffToTS(
  tuffSourceCode: string,
): Result<string, string> {
  const parsed = parseNumericSuffix(tuffSourceCode);
  if (parsed) {
    const { value, suffix } = parsed;
    const range = SUFFIX_RANGES[suffix];
    if (value < range.min || value > range.max) {
      return err(
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
    return ok("(function(): " + returnType + " { return " + literal + "; })()");
  }

  return ok("(function(): number { return " + tuffSourceCode + "; })()");
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
