import { describe, expect, test } from "bun:test";
import { interpretTuff } from "./index";

describe("interpretTuff", () => {
  test("returns 0 for an empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });

  test.each([
    ["100U8", 100],
    ["100U16", 100],
    ["100U32", 100],
    ["100U64", 100],
    ["-100I8", -100],
    ["-100I16", -100],
    ["-100I32", -100],
    ["-100I64", -100],
  ])("returns %s as %i", (input, expected) => {
    expect(interpretTuff(input)).toBe(expected);
  });

  test.each(["256U8", "65536U16", "10X8", "100u8", "not empty"])(
    "throws for invalid input %s",
    (input) => {
      expect(() => interpretTuff(input)).toThrow();
    },
  );

  test.each(["128I8", "32768I16", "2147483648I32"])(
    "throws for out-of-range input %s",
    (input) => {
      expect(() => interpretTuff(input)).toThrow();
    },
  );

  test('returns 100 for "25U8 + 75U8"', () => {
    expect(interpretTuff("25U8 + 75U8")).toBe(100);
  });

  test('returns 100 for "100"', () => {
    expect(interpretTuff("100")).toBe(100);
  });
});
