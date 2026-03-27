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

interface EnvVar {
  suffix: NumericSuffix;
  tsName: string;
}

type Env = Record<string, EnvVar>;

interface ParsedExpr {
  suffix: NumericSuffix;
  tsCode: string;
  value: bigint | undefined;
}

function getSuffixBits(suffix: NumericSuffix): number {
  return Number(suffix.slice(1));
}

function isSuffixSigned(suffix: NumericSuffix): boolean {
  return suffix.startsWith("I");
}

function isIdentifier(src: string): boolean {
  if (src.length === 0) return false;
  const first = src.charCodeAt(0);
  const isValidFirst =
    (first >= 97 && first <= 122) ||
    (first >= 65 && first <= 90) ||
    first === 95;
  if (!isValidFirst) return false;
  for (let i = 1; i < src.length; i++) {
    const c = src.charCodeAt(i);
    const isValid =
      (c >= 97 && c <= 122) ||
      (c >= 65 && c <= 90) ||
      (c >= 48 && c <= 57) ||
      c === 95;
    if (!isValid) return false;
  }
  return true;
}

function isAssignable(target: NumericSuffix, source: NumericSuffix): boolean {
  if (target === source) return true;
  const tRange = SUFFIX_RANGES[target];
  const sRange = SUFFIX_RANGES[source];
  return sRange.min >= tRange.min && sRange.max <= tRange.max;
}

function compileOperand(src: string, env: Env): Result<ParsedExpr, string> {
  const trimmed = src.trim();
  const read = parseReadExpr(trimmed);
  if (read !== undefined) {
    const range = SUFFIX_RANGES[read];
    return ok({
      suffix: read,
      tsCode: (range.bigint ? "BigInt" : "Number") + "(__tuff_stdin())",
      value: undefined,
    });
  }
  const num = parseNumericSuffix(trimmed);
  if (num !== undefined) {
    const range = SUFFIX_RANGES[num.suffix];
    if (num.value < range.min || num.value > range.max) {
      return err(
        "Value " +
          String(num.value) +
          " is out of range for " +
          num.suffix +
          " (" +
          String(range.min) +
          ".." +
          String(range.max) +
          ")",
      );
    }
    return ok({
      suffix: num.suffix,
      tsCode: range.bigint ? String(num.value) + "n" : String(num.value),
      value: num.value,
    });
  }
  if (isIdentifier(trimmed)) {
    if (!(trimmed in env)) {
      return err("Undeclared variable: " + trimmed);
    }
    return ok({
      suffix: env[trimmed].suffix,
      tsCode: env[trimmed].tsName,
      value: undefined,
    });
  }
  return err("Invalid operand: " + trimmed);
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

function castTypeScriptIfNeeded(
  tsCode: string,
  fromSuffix: NumericSuffix,
  toBigint: boolean,
): string {
  const fromBigint = SUFFIX_RANGES[fromSuffix].bigint;
  if (!fromBigint && toBigint) {
    return "BigInt(" + tsCode + ")";
  }
  return tsCode;
}

function compileExpr(src: string, env: Env): Result<ParsedExpr, string> {
  const trimmed = src.trim();
  for (const opStr of BINARY_OPS) {
    const idx = trimmed.indexOf(opStr);
    if (idx === -1) continue;
    const lhsStr = trimmed.slice(0, idx);
    const rhsStr = trimmed.slice(idx + opStr.length);
    const lhsRes = compileOperand(lhsStr, env);
    if (!lhsRes.ok) return lhsRes;
    const rhsRes = compileOperand(rhsStr, env);
    if (!rhsRes.ok) return rhsRes;

    const lhs = lhsRes.value;
    const rhs = rhsRes.value;
    const resultSuffix = widenSuffixes(lhs.suffix, rhs.suffix);
    if (resultSuffix === undefined) {
      return err(
        "Incompatible types: cannot widen " +
          lhs.suffix +
          " and " +
          rhs.suffix,
      );
    }
    const range = SUFFIX_RANGES[resultSuffix];

    let resultValue: bigint | undefined = undefined;
    if (lhs.value !== undefined && rhs.value !== undefined) {
      const lv = lhs.value;
      const rv = rhs.value;
      const op = opStr.trim();
      if (op === "/" && rv === 0n) return err("Division by zero");
      let result: bigint;
      if (op === "+") result = lv + rv;
      else if (op === "-") result = lv - rv;
      else if (op === "*") result = lv * rv;
      else result = lv / rv;

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
      resultValue = result;
    }

    const lhsCode = castTypeScriptIfNeeded(lhs.tsCode, lhs.suffix, range.bigint);
    const rhsCode = castTypeScriptIfNeeded(rhs.tsCode, rhs.suffix, range.bigint);

    return ok({
      suffix: resultSuffix,
      tsCode: lhsCode + " " + opStr.trim() + " " + rhsCode,
      value: resultValue,
    });
  }
  return compileOperand(trimmed, env);
}

export function compileTuffToTS(
  tuffSourceCode: string,
): Result<string, string> {
  const env: Env = {};
  const statements = tuffSourceCode
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    return err("Empty program");
  }

  const finalExprStr = statements.pop()!;
  let tsBody = "";
  let varCounter = 0;

  for (const stmt of statements) {
    if (!stmt.startsWith("let ")) {
      return err("Invalid statement (must start with let): " + stmt);
    }
    const idxEq = stmt.indexOf("=");
    if (idxEq === -1) {
      return err("Invalid let statement: " + stmt);
    }
    const leftPart = stmt.slice(4, idxEq).trim();
    const rightPart = stmt.slice(idxEq + 1).trim();

    let ident: string;
    let declaredType: NumericSuffix | undefined = undefined;
    const idxColon = leftPart.indexOf(":");
    if (idxColon !== -1) {
      ident = leftPart.slice(0, idxColon).trim();
      const typeStr = leftPart.slice(idxColon + 1).trim();
      const knownSuffixes: readonly string[] = NUMERIC_SUFFIXES;
      if (!knownSuffixes.includes(typeStr)) {
        return err("Unknown type annotation: " + typeStr);
      }
      declaredType = typeStr as NumericSuffix;
    } else {
      ident = leftPart;
    }

    if (!isIdentifier(ident)) {
      return err("Invalid identifier: " + ident);
    }

    const exprRes = compileExpr(rightPart, env);
    if (!exprRes.ok) return exprRes;
    const expr = exprRes.value;

    let actualType = expr.suffix;
    if (declaredType !== undefined) {
      if (!isAssignable(declaredType, expr.suffix)) {
        return err(
          "Type " +
            expr.suffix +
            " is not assignable to " +
            declaredType,
        );
      }
      actualType = declaredType;
    }

    const tsName = ident + "_" + String(varCounter++);
    env[ident] = { suffix: actualType, tsName };

    const rhsCode = castTypeScriptIfNeeded(
      expr.tsCode,
      expr.suffix,
      SUFFIX_RANGES[actualType].bigint,
    );
    tsBody += "  const " + tsName + " = " + rhsCode + ";\n";
  }

  const finalRes = compileExpr(finalExprStr, env);
  if (!finalRes.ok) return finalRes;
  const fin = finalRes.value;

  const returnType = SUFFIX_RANGES[fin.suffix].bigint ? "bigint" : "number";
  tsBody += "  return " + fin.tsCode + ";\n";

  return ok("(function(): " + returnType + " {\n/* eslint-disable */\n" + tsBody + "})()");
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
