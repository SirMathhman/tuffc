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
});
