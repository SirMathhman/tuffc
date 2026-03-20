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
});
