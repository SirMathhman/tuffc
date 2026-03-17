import { describe, it, expect } from "bun:test";
import { interpret } from "./interpret";

describe("interpret", () => {
  it("should return 0 for empty string", () => {
    expect(interpret("")).toBe(0);
  });
});
