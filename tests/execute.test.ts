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

test("execute with empty string returns 0", () => {
  const result = executeTuff("");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(0);
  }
});

test("execute 100U8 returns 100", () => {
  const result = executeTuff("100U8");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(100);
  }
});

// Positive integers with various types
test("positive integer with U16", () => {
  const result = executeTuff("1000U16");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(1000);
  }
});

test("positive integer with I32", () => {
  const result = executeTuff("42I32");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(42);
  }
});

test("positive integer with U64", () => {
  const result = executeTuff("999999U64");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(999999);
  }
});

// Negative integers with signed types
test("negative integer with I8", () => {
  const result = executeTuff("-100I8");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(-100);
  }
});

test("negative integer with I32", () => {
  const result = executeTuff("-42I32");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(-42);
  }
});

// Floating point numbers
test("float with F32 type", () => {
  const result = executeTuff("3.14F32");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(3.14);
  }
});

test("float with F64 type", () => {
  const result = executeTuff("2.71828F64");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(2.71828);
  }
});

test("float without type defaults to F32", () => {
  const result = executeTuff("5.5");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(5.5);
  }
});

test("negative float with F64", () => {
  const result = executeTuff("-1.5F64");
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(-1.5);
  }
});

// Invalid inputs - should return error Result
test("invalid type annotation returns error", () => {
  const result = executeTuff("100I128");
  expect(isErr(result)).toBe(true);
});

test("negative unsigned type returns error", () => {
  const result = executeTuff("-100U8");
  expect(isErr(result)).toBe(true);
});

test("non-numeric input returns error", () => {
  const result = executeTuff("abc");
  expect(isErr(result)).toBe(true);
});

test("input with whitespace returns error", () => {
  const result = executeTuff("100 U8");
  expect(isErr(result)).toBe(true);
});

test("leading whitespace returns error", () => {
  const result = executeTuff(" 100U8");
  expect(isErr(result)).toBe(true);
});
