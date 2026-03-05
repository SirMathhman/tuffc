import { test, expect } from "bun:test";
import { compile as compileTuffToJS } from "../src/compile";
import { type Result, isOk, isErr } from "../src/types";

/**
 * Executes compiled code by creating a new Function from the compiled
 * string and running it. The result of the function is coerced to a number.
 * Returns a Result to avoid throwing exceptions.
 */
export function executeTuff(input: string): Result<number, string> {
  const compileResult = compileTuffToJS(input);

  if (isErr(compileResult)) {
    return compileResult;
  }

  const compiled = compileResult.value;
  const fn = new Function(compiled);
  const result = fn();
  return { ok: true, value: Number(result) };
}

/**
 * Helper to assert a successful result matches an expected value
 */
function expectValue(result: Result<number, string>, expected: number): void {
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(expected);
  }
}

/**
 * Helper to assert a result is an error
 */
function expectError(result: Result<number, string>): void {
  expect(isErr(result)).toBe(true);
}

test("execute with empty string returns 0", () => {
  expectValue(executeTuff(""), 0);
});

test("execute 100U8 returns 100", () => {
  expectValue(executeTuff("100U8"), 100);
});

// Positive integers with various types
test("positive integer with U16", () => {
  expectValue(executeTuff("1000U16"), 1000);
});

test("positive integer with I32", () => {
  expectValue(executeTuff("42I32"), 42);
});

test("positive integer with U64", () => {
  expectValue(executeTuff("999999U64"), 999999);
});

// Negative integers with signed types
test("negative integer with I8", () => {
  expectValue(executeTuff("-100I8"), -100);
});

test("negative integer with I32", () => {
  expectValue(executeTuff("-42I32"), -42);
});

// Floating point numbers
test("float with F32 type", () => {
  expectValue(executeTuff("3.14F32"), 3.14);
});

test("float with F64 type", () => {
  expectValue(executeTuff("2.71828F64"), 2.71828);
});

test("float without type defaults to F32", () => {
  expectValue(executeTuff("5.5"), 5.5);
});

test("negative float with F64", () => {
  expectValue(executeTuff("-1.5F64"), -1.5);
});

// Invalid inputs - should return error Result
test("invalid type annotation returns error", () => {
  expectError(executeTuff("100I128"));
});

test("negative unsigned type returns error", () => {
  expectError(executeTuff("-100U8"));
});

test("non-numeric input returns error", () => {
  expectError(executeTuff("abc"));
});

test("input with whitespace returns error", () => {
  expectError(executeTuff("100 U8"));
});

test("leading whitespace returns error", () => {
  expectError(executeTuff(" 100U8"));
});

// Arithmetic expressions
test("simple addition", () => {
  expectValue(executeTuff("2U8 + 3U8"), 5);
});

test("simple subtraction", () => {
  expectValue(executeTuff("5I32 - 2I32"), 3);
});

test("simple multiplication", () => {
  expectValue(executeTuff("3U8 * 4U8"), 12);
});

test("simple division", () => {
  expectValue(executeTuff("10I32 / 2I32"), 5);
});

test("operator precedence: multiplication before addition", () => {
  expectValue(executeTuff("2I32 + 3I32 * 4I32"), 14);
});

test("parentheses override precedence", () => {
  expectValue(executeTuff("(2I32 + 3I32) * 4I32"), 20);
});

test("type widening: U8 + U16", () => {
  expectValue(executeTuff("2U8 + 3U16"), 5);
});

test("addition without whitespace", () => {
  expectValue(executeTuff("2U8+3U8"), 5);
});

test("multiple additions", () => {
  expectValue(executeTuff("1I32 + 2I32 + 3I32"), 6);
});
