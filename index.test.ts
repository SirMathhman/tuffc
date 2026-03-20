import { describe, it, expect } from "bun:test";
import { interpretTuff } from "./index";

describe("interpretTuff", () => {
  it("should return 0 for empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });
});
