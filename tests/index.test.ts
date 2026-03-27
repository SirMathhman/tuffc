import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { compileTuffToTS, compileTSToJS } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executeTuffCode(
  tuffSourceCode: string,
  stdIn?: string,
): Promise<number | bigint> {
  const compileResult = compileTuffToTS(tuffSourceCode);
  if (!compileResult.ok) {
    return Promise.reject(new Error(compileResult.error));
  }
  const tsCode = compileResult.value;

  const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });
  const results = await eslint.lintText(tsCode, { filePath: "generated.ts" });
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  );
  if (errors.length > 0) {
    return Promise.reject(
      new Error(
        "ESLint errors in generated code:\n" +
          errors
            .map((e) => e.line + ":" + e.column + " " + e.message)
            .join("\n"),
      ),
    );
  }

  const jsCode = compileTSToJS(tsCode);
  const stdinFn = stdIn !== undefined ? () => stdIn : () => "";
  return new Function("__tuff_stdin", "return " + jsCode)(stdinFn) as
    | number
    | bigint;
}

const VALID_CASES: [string, number | bigint][] = [
  ["100U8", 100],
  ["0U8", 0],
  ["255U8", 255],
  ["127I8", 127],
  ["-128I8", -128],
  ["65535U16", 65535],
  ["4294967295U32", 4294967295],
  ["100U64", 100n],
  ["100I64", 100n],
];

const OUT_OF_RANGE_CASES: string[] = [
  "256U8",
  "-1U8",
  "128I8",
  "-129I8",
  "65536U16",
  "4294967296U32",
];

for (const [input, expected] of VALID_CASES) {
  test(
    "executeTuffCode('" + input + "') returns " + String(expected),
    async () => {
      assert.equal(await executeTuffCode(input), expected);
    },
  );
}

for (const input of OUT_OF_RANGE_CASES) {
  test("executeTuffCode('" + input + "') throws compile error", () =>
    assert.rejects(
      () => executeTuffCode(input),
      (err: unknown) =>
        err instanceof Error &&
        err.message.toLowerCase().includes("out of range"),
    ),
  );
}

type ReadCase = [string, string, number | bigint];

const READ_CASES: ReadCase[] = [
  ["read<U8>()", "100", 100],
  ["read<U16>()", "1000", 1000],
  ["read<U32>()", "100000", 100000],
  ["read<U64>()", "100", 100n],
  ["read<I8>()", "-50", -50],
  ["read<I16>()", "-1000", -1000],
  ["read<I32>()", "-100000", -100000],
  ["read<I64>()", "-100", -100n],
];

for (const [expr, stdin, expected] of READ_CASES) {
  test(
    "executeTuffCode('" +
      expr +
      "', '" +
      stdin +
      "') returns " +
      String(expected),
    async () => {
      assert.equal(await executeTuffCode(expr, stdin), expected);
    },
  );
}

type BinaryCase = [string, string, number | bigint];

const BINARY_CASES: BinaryCase[] = [
  ["read<U8>() + 50U8", "100", 150],
  ["read<U8>() - 50U8", "100", 50],
  ["read<U16>() * 2U16", "10", 20],
  ["read<U16>() / 2U16", "100", 50],
  ["200U16 + read<U8>()", "50", 250],
  ["read<U8>() + read<U8>()", "100", 200],
  ["read<U8>() + 1000U16", "100", 1100],
  ["read<I8>() + 10U8", "-50", -40],
  ["100U8 + 100U8", "", 200],
  ["read<U8>() + 100U64", "50", 150n],
];

for (const [expr, stdin, expected] of BINARY_CASES) {
  test(
    "executeTuffCode('" +
      expr +
      "', '" +
      stdin +
      "') returns " +
      String(expected),
    async () => {
      assert.equal(await executeTuffCode(expr, stdin), expected);
    },
  );
}

type BinaryErrorCase = [string, string];

const BINARY_ERROR_CASES: BinaryErrorCase[] = [
  ["200U8 + 100U8", "out of range"],
  ["100U8 - 200U8", "out of range"],
  ["read<U64>() + 50I8", "incompatible"],
];

for (const [expr, fragment] of BINARY_ERROR_CASES) {
  test("executeTuffCode('" + expr + "') rejects with '" + fragment + "'", () =>
    assert.rejects(
      () => executeTuffCode(expr),
      (e: unknown) =>
        e instanceof Error &&
        e.message.toLowerCase().includes(fragment.toLowerCase()),
    ),
  );
}

type LetCase = [string, string, number | bigint];

const LET_CASES: LetCase[] = [
  ["let x : U8 = read<U8>() + 50U8; x", "100", 150],
  ["let x = 100U8; x + x", "", 200],
  ["let x = 10U8; let y: U16 = x; y", "", 10],
  ["let x = 10U8; let x = 20U16; x", "", 20],
  ["let a = read<U16>(); let b = a * 2U16; b + a", "100", 300],
];

for (const [prog, stdin, expected] of LET_CASES) {
  test(
    "executeTuffCode let statement returns " + String(expected),
    async () => {
      assert.equal(await executeTuffCode(prog, stdin), expected);
    },
  );
}

type LetErrorCase = [string, string];

const LET_ERROR_CASES: LetErrorCase[] = [
  ["let x : U8 = 100U16; x", "not assignable"],
  ["let x = 10U8; x + y", "undeclared"],
];

for (const [prog, fragment] of LET_ERROR_CASES) {
  test("executeTuffCode('" + prog + "') rejects with '" + fragment + "'", () =>
    assert.rejects(
      () => executeTuffCode(prog),
      (e: unknown) =>
        e instanceof Error &&
        e.message.toLowerCase().includes(fragment.toLowerCase()),
    ),
  );
}
