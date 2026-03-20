import { describe, it, expect } from "bun:test";
import { interpretTuff } from "./index";

describe("interpretTuff", () => {
  it("should return 0 for empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });

  it("should parse numeric string 100 as number 100", () => {
    expect(interpretTuff("100")).toBe(100);
  });

  it("should throw for invalid input", () => {
    expect(() => interpretTuff("invalid")).toThrow(
      "Invalid Tuff input: invalid",
    );
  });

  it("should parse U8 suffix numeric string 100U8 as number 100", () => {
    expect(interpretTuff("100U8")).toBe(100);
  });

  it("should throw for negative U8 suffix input", () => {
    expect(() => interpretTuff("-100U8")).toThrow("Invalid Tuff input: -100U8");
  });

  it("should throw for out-of-range U8 suffix input", () => {
    expect(() => interpretTuff("256U8")).toThrow("Invalid Tuff input: 256U8");
  });

  const typedCases: Array<[string, number]> = [
    ["100U8", 100],
    ["100U16", 100],
    ["100U32", 100],
    ["100U64", 100],
    ["-100I8", -100],
    ["-100I16", -100],
    ["-100I32", -100],
    ["-100I64", -100],
  ];

  for (const [input, expected] of typedCases) {
    it(`should parse typed suffix ${input} as ${expected}`, () => {
      expect(interpretTuff(input)).toBe(expected);
    });
  }

  it("should throw for unsupported suffix", () => {
    expect(() => interpretTuff("100U128")).toThrow(
      "Invalid Tuff input: 100U128",
    );
  });

  it("should evaluate addition expression with U8 values", () => {
    expect(interpretTuff("1U8 + 2U8")).toBe(3);
  });

  it("should evaluate addition expression with U8 and plain numeric", () => {
    expect(interpretTuff("1U8 + 254")).toBe(255);
  });

  it("should throw for overflow of U8 on addition expression", () => {
    expect(() => interpretTuff("1U8 + 255")).toThrow(
      "Invalid Tuff input: 1U8 + 255",
    );
  });

  it("should evaluate addition across U8 and U16 to wide result", () => {
    expect(interpretTuff("1U8 + 255U16")).toBe(256);
  });

  it("should evaluate subtraction expression with U8 values", () => {
    expect(interpretTuff("5U8 - 2U8")).toBe(3);
  });

  it("should throw for underflow of U8 on subtraction expression", () => {
    expect(() => interpretTuff("0U8 - 1U8")).toThrow(
      "Invalid Tuff input: 0U8 - 1U8",
    );
  });

  it("should evaluate operator precedence correctly", () => {
    expect(interpretTuff("1 + 2 * 3")).toBe(7);
  });
});
