import { describe, it, expect } from "bun:test";
import { interpret } from "./interpret";

describe("interpret", () => {
  it("should return 0 for empty string", () => {
    expect(interpret("")).toBe(0);
  });

  it("should parse numeric literal with U8 suffix", () => {
    expect(interpret("100U8")).toBe(100);
  });

  it("should parse just digits without suffix", () => {
    expect(interpret("100")).toBe(100);
  });

  it("should throw on non-numeric input", () => {
    expect(() => interpret("abc")).toThrow();
  });

  // Expression parsing - Addition
  it("should parse addition with I64 types", () => {
    expect(interpret("20I64 + 30I64")).toBe(50);
  });

  it("should parse addition without spaces", () => {
    expect(interpret("20I64+30I64")).toBe(50);
  });

  // Expression parsing - Subtraction
  it("should parse subtraction", () => {
    expect(interpret("50I64 - 20I64")).toBe(30);
  });

  // Expression parsing - Multiplication
  it("should parse multiplication", () => {
    expect(interpret("10I64 * 5I64")).toBe(50);
  });

  // Expression parsing - Division
  it("should parse division", () => {
    expect(interpret("100I64 / 2I64")).toBe(50);
  });

  // Operator precedence
  it("should handle multiplication before addition", () => {
    expect(interpret("10I64 * 5I64 + 10I64 - 5I64")).toBe(55);
  });

  it("should handle division before subtraction", () => {
    expect(interpret("100I64 / 2I64 - 10I64")).toBe(40);
  });

  // Different numeric types
  it("should parse expression with U8 types", () => {
    expect(interpret("20U8 + 30U8")).toBe(50);
  });

  it("should parse expression with mixed I32 and I64", () => {
    expect(interpret("20I32 + 30I64")).toBe(50);
  });

  // Error cases
  it("should throw on incomplete expression", () => {
    expect(() => interpret("20I64 +")).toThrow();
  });

  it("should throw on division by zero", () => {
    expect(() => interpret("100I64 / 0I64")).toThrow();
  });

  it("should throw on invalid syntax (double operator)", () => {
    expect(() => interpret("20I64 + + 30I64")).toThrow();
  });

  it("should throw on non-numeric token in expression", () => {
    expect(() => interpret("20I64 + abc")).toThrow();
  });

  it("should throw on trailing operator", () => {
    expect(() => interpret("20I64 + 30I64 +")).toThrow();
  });
});
