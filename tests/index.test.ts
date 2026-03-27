import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { compileTuffToTS, compileTSToJS } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executeTuffCode(tuffSourceCode: string): Promise<number | bigint> {
  const tsCode = compileTuffToTS(tuffSourceCode);

  const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });
  const results = await eslint.lintText(tsCode, { filePath: "generated.ts" });
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  );
  if (errors.length > 0) {
    throw new Error(
      `ESLint errors in generated code:\n${errors.map((e) => `${e.line}:${e.column} ${e.message}`).join("\n")}`,
    );
  }

  const jsCode = compileTSToJS(tsCode);
  return new Function(`return ${jsCode}`)() as number | bigint;
}

test("executeTuffCode('100') returns 100", async () => {
  assert.equal(await executeTuffCode("100"), 100);
});

// U8
test("executeTuffCode('100U8') returns 100", async () => {
  assert.equal(await executeTuffCode("100U8"), 100);
});
test("executeTuffCode('0U8') returns 0", async () => {
  assert.equal(await executeTuffCode("0U8"), 0);
});
test("executeTuffCode('255U8') returns 255", async () => {
  assert.equal(await executeTuffCode("255U8"), 255);
});
test("executeTuffCode('256U8') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("256U8"), /out of range/i);
});
test("executeTuffCode('-1U8') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("-1U8"), /out of range/i);
});

// I8
test("executeTuffCode('127I8') returns 127", async () => {
  assert.equal(await executeTuffCode("127I8"), 127);
});
test("executeTuffCode('-128I8') returns -128", async () => {
  assert.equal(await executeTuffCode("-128I8"), -128);
});
test("executeTuffCode('128I8') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("128I8"), /out of range/i);
});
test("executeTuffCode('-129I8') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("-129I8"), /out of range/i);
});

// U16
test("executeTuffCode('65535U16') returns 65535", async () => {
  assert.equal(await executeTuffCode("65535U16"), 65535);
});
test("executeTuffCode('65536U16') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("65536U16"), /out of range/i);
});

// U32
test("executeTuffCode('4294967295U32') returns 4294967295", async () => {
  assert.equal(await executeTuffCode("4294967295U32"), 4294967295);
});
test("executeTuffCode('4294967296U32') throws compile error", async () => {
  await assert.rejects(() => executeTuffCode("4294967296U32"), /out of range/i);
});

// U64 (BigInt)
test("executeTuffCode('100U64') returns 100n", async () => {
  assert.equal(await executeTuffCode("100U64"), 100n);
});

// I64 (BigInt)
test("executeTuffCode('100I64') returns 100n", async () => {
  assert.equal(await executeTuffCode("100I64"), 100n);
});
