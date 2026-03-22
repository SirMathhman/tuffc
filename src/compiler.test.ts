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

// ── Arithmetic and generic reads ──────────────────────────────────────────

test("compileTuffAndExecute respects precedence for multiplication", () => {
  assert.strictEqual(compileTuffAndExecute("1U8 + 2U8 * 3U8"), 7);
});

test("compileTuffAndExecute respects parentheses for grouping", () => {
  assert.strictEqual(compileTuffAndExecute("(1U8 + 2U8) * 3U8"), 9);
});

test("compileTuffAndExecute supports unary minus on expressions", () => {
  assert.strictEqual(compileTuffAndExecute("-(read<I8>())", "5"), -5);
});

test("compileTuffAndExecute promotes integer addition when needed", () => {
  assert.strictEqual(compileTuffAndExecute("200U8 + 100U8"), 300);
});

test("compileTuffAndExecute truncates integer division toward zero", () => {
  assert.strictEqual(compileTuffAndExecute("5U8 / 2U8"), 2);
});

test("compileTuffAndExecute throws on division by zero", () => {
  assert.throws(() => compileTuffAndExecute("5U8 / 0U8"));
});

test("compileTuffAndExecute reads whitespace-separated stdin tokens", () => {
  assert.strictEqual(
    compileTuffAndExecute("read<U8>() + read<U8>()", "100 200"),
    300,
  );
});

test("compileTuffAndExecute reads generic integer types", () => {
  assert.strictEqual(
    compileTuffAndExecute("read<I16>() + read<U8>()", "-50 200"),
    150,
  );
});

test("compileTuffAndExecute promotes mixed int and float arithmetic", () => {
  assert.strictEqual(compileTuffAndExecute("1U8 + 2.5F32"), 3.5);
});

test("compileTuffAndExecute throws when integer arithmetic overflows", () => {
  assert.throws(() => compileTuffAndExecute("18446744073709551615U64 + 1U64"));
});

// ── Let statements ────────────────────────────────────────────────────────

test("compileTuffAndExecute supports let with typed read initializer", () => {
  assert.strictEqual(
    compileTuffAndExecute("let x : U8 = read<U8>(); x", "100"),
    100,
  );
});

test("compileTuffAndExecute supports inferred let bindings", () => {
  assert.strictEqual(compileTuffAndExecute("let x = 100U8; x"), 100);
});

test("compileTuffAndExecute supports mutable let reassignment", () => {
  assert.strictEqual(
    compileTuffAndExecute("let mut x = 0U8; x = 100U8; x"),
    100,
  );
});

test("compileTuffAndExecute supports uninitialized mutable bindings", () => {
  assert.strictEqual(
    compileTuffAndExecute("let mut x : U8; x = read<U8>(); x", "100"),
    100,
  );
});

test("compileTuffAndExecute allows redeclaration to shadow earlier lets", () => {
  assert.strictEqual(compileTuffAndExecute("let x = 1U8; let x = 2U8; x"), 2);
});

test("compileTuffAndExecute throws when assigning to an immutable let", () => {
  assert.throws(() => compileTuffAndExecute("let x = 0U8; x = 1U8; x"));
});

test("compileTuffAndExecute throws when reading an uninitialized let", () => {
  assert.throws(() => compileTuffAndExecute("let mut x : U8; x"));
});

test("compileTuffAndExecute throws when initializer does not fit declared type", () => {
  assert.throws(() => compileTuffAndExecute("let x : U8 = 300U16; x"));
});

// ── Bool ──────────────────────────────────────────────────────────────────

test("compileTuffAndExecute returns 1 for true", () => {
  assert.strictEqual(compileTuffAndExecute("true"), 1);
});

test("compileTuffAndExecute returns 0 for false", () => {
  assert.strictEqual(compileTuffAndExecute("false"), 0);
});

test("compileTuffAndExecute supports Bool let bindings", () => {
  assert.strictEqual(compileTuffAndExecute("let x : Bool = true; x"), 1);
});

test("compileTuffAndExecute supports mutable Bool reassignment", () => {
  assert.strictEqual(
    compileTuffAndExecute("let mut x : Bool; x = false; x"),
    0,
  );
});

test("compileTuffAndExecute reads Bool stdin tokens", () => {
  assert.strictEqual(compileTuffAndExecute("read<Bool>()", "true"), 1);
});

test("compileTuffAndExecute throws when Bool stdin token is invalid", () => {
  assert.throws(() => compileTuffAndExecute("read<Bool>()", "yes"));
});

test("compileTuffAndExecute throws when assigning numeric values to Bool", () => {
  assert.throws(() => compileTuffAndExecute("let mut x : Bool; x = 1U8; x"));
});

test("compileTuffAndExecute throws when Bool is used in arithmetic", () => {
  assert.throws(() => compileTuffAndExecute("true + 1U8"));
});
