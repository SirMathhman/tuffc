import { describe, test, expect } from "bun:test";
import { interpretTuff } from "./index";

describe("interpretTuff", () => {
  test("empty string => 0", () => {
    expect(interpretTuff("")).toBe(0);
  });

  test('"100" => 100', () => {
    expect(interpretTuff("100")).toBe(100);
  });

  test('"100U8" => 100', () => {
    expect(interpretTuff("100U8")).toBe(100);
  });
});
