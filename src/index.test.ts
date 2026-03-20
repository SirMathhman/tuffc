import { describe, expect, test } from "bun:test";
import { interpretTuff } from "./index";

describe("interpretTuff", () => {
  test("returns 0 for an empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });

  test('returns 100 for "100"', () => {
    expect(interpretTuff("100")).toBe(100);
  });

  test("throws for non-empty input", () => {
    expect(() => interpretTuff("not empty")).toThrow();
  });
});
