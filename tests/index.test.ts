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

test("executeTuffCode('100') returns 100", async () => {
  assert.equal(await executeTuffCode("100"), 100);
});

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
