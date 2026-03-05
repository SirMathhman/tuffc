import { test, expect } from "bun:test";
import { compile as compileTuffToJS } from "./compile";

/**
 * Executes compiled code by creating a new Function from the compiled
 * string and running it. The result of the function is coerced to a number.
 */
export function executeTuff(input: string): number {
  const compiled = compileTuffToJS(input);
  const fn = new Function(compiled);
  const result = fn();
  return Number(result);
}

test("execute with empty string returns 0", () => {
  expect(executeTuff("")).toBe(0);
});

test("execute 100U8 returns 100", () => {
  expect(executeTuff("100U8")).toBe(100);
});

// Positive integers with various types
test("positive integer with U16", () => {
  expect(executeTuff("1000U16")).toBe(1000);
});

test("positive integer with I32", () => {
  expect(executeTuff("42I32")).toBe(42);
});

test("positive integer with U64", () => {
  expect(executeTuff("999999U64")).toBe(999999);
});

// Negative integers with signed types
test("negative integer with I8", () => {
  expect(executeTuff("-100I8")).toBe(-100);
});

test("negative integer with I32", () => {
  expect(executeTuff("-42I32")).toBe(-42);
});

// Floating point numbers
test("float with F32 type", () => {
  expect(executeTuff("3.14F32")).toBe(3.14);
});

test("float with F64 type", () => {
  expect(executeTuff("2.71828F64")).toBe(2.71828);
});

test("float without type defaults to F32", () => {
  expect(executeTuff("5.5")).toBe(5.5);
});

test("negative float with F64", () => {
  expect(executeTuff("-1.5F64")).toBe(-1.5);
});

// Invalid inputs - should throw
test("invalid type annotation throws", () => {
  expect(() => executeTuff("100I128")).toThrow();
});

test("negative unsigned type throws", () => {
  expect(() => executeTuff("-100U8")).toThrow();
});

test("non-numeric input throws", () => {
  expect(() => executeTuff("abc")).toThrow();
});

test("input with whitespace throws", () => {
  expect(() => executeTuff("100 U8")).toThrow();
});

test("leading whitespace throws", () => {
  expect(() => executeTuff(" 100U8")).toThrow();
});
