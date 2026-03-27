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

const SIGNED_SUFFIXES: readonly NumericSuffix[] = ["I8", "I16", "I32", "I64"];

const BINARY_OPS: readonly string[] = [" + ", " - ", " * ", " / "];

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

function parseReadExpr(src: string): NumericSuffix | undefined {
  const trimmed = src.trim();
  const READ_PREFIX = "read<";
  const READ_SUFFIX = ">()";
  if (!trimmed.startsWith(READ_PREFIX) || !trimmed.endsWith(READ_SUFFIX))
    return undefined;
  const candidate = trimmed.slice(
    READ_PREFIX.length,
    trimmed.length - READ_SUFFIX.length,
  );
  const knownSuffixes: readonly string[] = NUMERIC_SUFFIXES;
  if (!knownSuffixes.includes(candidate)) return undefined;
  return candidate as NumericSuffix;
}

interface ParsedOperand {
  suffix: NumericSuffix;
  isRead: boolean;
  value: bigint | undefined;
}

interface BinaryExpr {
  lhs: ParsedOperand;
  op: string;
  rhs: ParsedOperand;
}

function getSuffixBits(suffix: NumericSuffix): number {
  return Number(suffix.slice(1));
}

function isSuffixSigned(suffix: NumericSuffix): boolean {
  return suffix.startsWith("I");
}

function parseOperand(src: string): ParsedOperand | undefined {
  const trimmed = src.trim();
  const read = parseReadExpr(trimmed);
  if (read !== undefined) {
    return { suffix: read, isRead: true, value: undefined };
  }
  const num = parseNumericSuffix(trimmed);
  if (num !== undefined) {
    return { suffix: num.suffix, isRead: false, value: num.value };
  }
  return undefined;
}

function parseBinaryExpr(src: string): BinaryExpr | undefined {
  const trimmed = src.trim();
  for (const opStr of BINARY_OPS) {
    const idx = trimmed.indexOf(opStr);
    if (idx === -1) continue;
    const lhsStr = trimmed.slice(0, idx);
    const rhsStr = trimmed.slice(idx + opStr.length);
    const lhs = parseOperand(lhsStr);
    if (lhs === undefined) continue;
    const rhs = parseOperand(rhsStr);
    if (rhs === undefined) continue;
    return { lhs, op: opStr.trim(), rhs };
  }
  return undefined;
}

function widenSuffixes(
  a: NumericSuffix,
  b: NumericSuffix,
): NumericSuffix | undefined {
  if (a === b) return a;
  const aSigned = isSuffixSigned(a);
  const bSigned = isSuffixSigned(b);
  const aBits = getSuffixBits(a);
  const bBits = getSuffixBits(b);
  if (aSigned === bSigned) {
    const bits = Math.max(aBits, bBits);
    return ((aSigned ? "I" : "U") + String(bits)) as NumericSuffix;
  }
  const unsignedBits = aSigned ? bBits : aBits;
  const signedBits = aSigned ? aBits : bBits;
  const fittingSigned = SIGNED_SUFFIXES.find(
    (s) => getSuffixBits(s) > unsignedBits,
  );
  if (fittingSigned === undefined) return undefined;
  const minBits = Math.max(getSuffixBits(fittingSigned), signedBits);
  return SIGNED_SUFFIXES.find((s) => getSuffixBits(s) === minBits);
}

function emitOperand(op: ParsedOperand, resultBigint: boolean): string {
  if (op.isRead) {
    return (resultBigint ? "BigInt" : "Number") + "(__tuff_stdin())";
  }
  if (resultBigint) {
    return String(op.value) + "n";
  }
  return String(op.value);
}

function compileBinaryExpr(expr: BinaryExpr): Result<string, string> {
  const resultSuffix = widenSuffixes(expr.lhs.suffix, expr.rhs.suffix);
  if (resultSuffix === undefined) {
    return err(
      "Incompatible types: cannot widen " +
        expr.lhs.suffix +
        " and " +
        expr.rhs.suffix,
    );
  }
  const range = SUFFIX_RANGES[resultSuffix];
  if (!expr.lhs.isRead && !expr.rhs.isRead) {
    const lv = expr.lhs.value as bigint;
    const rv = expr.rhs.value as bigint;
    if (expr.op === "/" && rv === 0n) {
      return err("Division by zero");
    }
    let result: bigint;
    if (expr.op === "+") {
      result = lv + rv;
    } else if (expr.op === "-") {
      result = lv - rv;
    } else if (expr.op === "*") {
      result = lv * rv;
    } else {
      result = lv / rv;
    }
    if (result < range.min || result > range.max) {
      return err(
        "Result " +
          String(result) +
          " is out of range for " +
          resultSuffix +
          " (" +
          String(range.min) +
          ".." +
          String(range.max) +
          ")",
      );
    }
  }
  const returnType = range.bigint ? "bigint" : "number";
  const lhsExpr = emitOperand(expr.lhs, range.bigint);
  const rhsExpr = emitOperand(expr.rhs, range.bigint);
  return ok(
    "(function(): " +
      returnType +
      " { return " +
      lhsExpr +
      " " +
      expr.op +
      " " +
      rhsExpr +
      "; })()",
  );
}

export function compileTuffToTS(
  tuffSourceCode: string,
): Result<string, string> {
  const binary = parseBinaryExpr(tuffSourceCode);
  if (binary !== undefined) {
    return compileBinaryExpr(binary);
  }

  const readSuffix = parseReadExpr(tuffSourceCode);
  if (readSuffix !== undefined) {
    const range = SUFFIX_RANGES[readSuffix];
    const castFn = range.bigint ? "BigInt" : "Number";
    const returnType = range.bigint ? "bigint" : "number";
    return ok(
      "(function(): " +
        returnType +
        " { return " +
        castFn +
        "(__tuff_stdin()); })()",
    );
  }

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
