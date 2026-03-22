import assert from "node:assert/strict";
import test from "node:test";

import { compileTuffAndExecute } from "./compiler";

test("compileTuffAndExecute returns 0 for an empty program", () => {
  assert.strictEqual(compileTuffAndExecute(""), 0);
});

test("compileTuffAndExecute returns stdin for read U8", () => {
  assert.strictEqual(compileTuffAndExecute("read<U8>()", "100"), 100);
});

// ── U8 ─────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 100 for 100U8", () => {
  assert.strictEqual(compileTuffAndExecute("100U8"), 100);
});

test("compileTuffAndExecute returns 0 for 0U8", () => {
  assert.strictEqual(compileTuffAndExecute("0U8"), 0);
});

test("compileTuffAndExecute returns 255 for 255U8", () => {
  assert.strictEqual(compileTuffAndExecute("255U8"), 255);
});

test("compileTuffAndExecute throws for 256U8 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("256U8"));
});

test("compileTuffAndExecute throws for -1U8 (negative unsigned)", () => {
  assert.throws(() => compileTuffAndExecute("-1U8"));
});

// ── U16 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0U16", () => {
  assert.strictEqual(compileTuffAndExecute("0U16"), 0);
});

test("compileTuffAndExecute returns 65535 for 65535U16", () => {
  assert.strictEqual(compileTuffAndExecute("65535U16"), 65535);
});

test("compileTuffAndExecute throws for 65536U16 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("65536U16"));
});

// ── U32 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0U32", () => {
  assert.strictEqual(compileTuffAndExecute("0U32"), 0);
});

test("compileTuffAndExecute returns 4294967295 for 4294967295U32", () => {
  assert.strictEqual(compileTuffAndExecute("4294967295U32"), 4294967295);
});

test("compileTuffAndExecute throws for 4294967296U32 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("4294967296U32"));
});

// ── U64 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0U64", () => {
  assert.strictEqual(compileTuffAndExecute("0U64"), 0);
});

test("compileTuffAndExecute returns 100 for 100U64", () => {
  assert.strictEqual(compileTuffAndExecute("100U64"), 100);
});

test("compileTuffAndExecute throws for 18446744073709551616U64 (overflow past 2^64)", () => {
  assert.throws(() => compileTuffAndExecute("18446744073709551616U64"));
});

// ── I8 ─────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns -1 for -1I8", () => {
  assert.strictEqual(compileTuffAndExecute("-1I8"), -1);
});

test("compileTuffAndExecute returns -128 for -128I8", () => {
  assert.strictEqual(compileTuffAndExecute("-128I8"), -128);
});

test("compileTuffAndExecute returns 0 for 0I8", () => {
  assert.strictEqual(compileTuffAndExecute("0I8"), 0);
});

test("compileTuffAndExecute returns 127 for 127I8", () => {
  assert.strictEqual(compileTuffAndExecute("127I8"), 127);
});

test("compileTuffAndExecute throws for 128I8 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("128I8"));
});

test("compileTuffAndExecute throws for -129I8 (underflow)", () => {
  assert.throws(() => compileTuffAndExecute("-129I8"));
});

// ── I16 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns -32768 for -32768I16", () => {
  assert.strictEqual(compileTuffAndExecute("-32768I16"), -32768);
});

test("compileTuffAndExecute returns 32767 for 32767I16", () => {
  assert.strictEqual(compileTuffAndExecute("32767I16"), 32767);
});

test("compileTuffAndExecute throws for 32768I16 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("32768I16"));
});

// ── I32 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns -2147483648 for -2147483648I32", () => {
  assert.strictEqual(compileTuffAndExecute("-2147483648I32"), -2147483648);
});

test("compileTuffAndExecute returns 2147483647 for 2147483647I32", () => {
  assert.strictEqual(compileTuffAndExecute("2147483647I32"), 2147483647);
});

test("compileTuffAndExecute throws for 2147483648I32 (overflow)", () => {
  assert.throws(() => compileTuffAndExecute("2147483648I32"));
});

// ── I64 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0I64", () => {
  assert.strictEqual(compileTuffAndExecute("0I64"), 0);
});

test("compileTuffAndExecute returns -100 for -100I64", () => {
  assert.strictEqual(compileTuffAndExecute("-100I64"), -100);
});

test("compileTuffAndExecute throws for 9223372036854775808I64 (overflow past I64 max)", () => {
  assert.throws(() => compileTuffAndExecute("9223372036854775808I64"));
});

// ── F32 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0.0F32", () => {
  assert.strictEqual(compileTuffAndExecute("0.0F32"), 0);
});

test("compileTuffAndExecute returns 3.14 for 3.14F32", () => {
  assert.strictEqual(compileTuffAndExecute("3.14F32"), 3.14);
});

test("compileTuffAndExecute returns -3.14 for -3.14F32", () => {
  assert.strictEqual(compileTuffAndExecute("-3.14F32"), -3.14);
});

test("compileTuffAndExecute throws for out-of-range F32 literal", () => {
  // 4e38 > F32_MAX (~3.4028235e38)
  assert.throws(() =>
    compileTuffAndExecute("400000000000000000000000000000000000000.0F32"),
  );
});

// ── F64 ────────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 0 for 0.0F64", () => {
  assert.strictEqual(compileTuffAndExecute("0.0F64"), 0);
});

test("compileTuffAndExecute returns 1.5 for 1.5F64", () => {
  assert.strictEqual(compileTuffAndExecute("1.5F64"), 1.5);
});

test("compileTuffAndExecute returns -1.5 for -1.5F64", () => {
  assert.strictEqual(compileTuffAndExecute("-1.5F64"), -1.5);
});
