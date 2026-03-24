import { describe, expect, test } from "bun:test";
import { interpretTuff } from "../src/index";

describe("interpretTuff", () => {
  test("returns a number", () => {
    expect(interpretTuff("any input")).toBe(0);
  });

  test("returns 0 for an empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });

  test("returns the leading integer prefix", () => {
    expect(interpretTuff("100U8")).toBe(100);
  });

  test("rejects negative numeric prefixes", () => {
    expect(() => interpretTuff("-100U8")).toThrow();
  });

  test("returns a negative value for signed I8 input", () => {
    expect(interpretTuff("-100I8")).toBe(-100);
  });

  test("returns a negative value for signed I16 input", () => {
    expect(interpretTuff("-100I16")).toBe(-100);
  });

  test("rejects U8 values above 255", () => {
    expect(() => interpretTuff("256U8")).toThrow();
  });
});
