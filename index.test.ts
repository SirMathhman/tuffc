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
});
