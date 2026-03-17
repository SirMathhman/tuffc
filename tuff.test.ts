import { executeTuff } from "./tuff";

describe("executeTuff", () => {
  it("returns 0 for empty source", () => {
    expect(executeTuff("")).toBe(0);
  });

  it("returns 100 for a valid U8 literal", () => {
    expect(executeTuff("100U8")).toBe(100);
  });

  it("returns 0 for the minimum U8 literal", () => {
    expect(executeTuff("0U8")).toBe(0);
  });

  it("returns 255 for the maximum U8 literal", () => {
    expect(executeTuff("255U8")).toBe(255);
  });

  it("throws for U8 values above 255", () => {
    expect(() => executeTuff("256U8")).toThrow("U8 literal out of range");
  });

  it("throws for negative U8 values", () => {
    expect(() => executeTuff("-1U8")).toThrow("Invalid U8 literal");
  });

  it("throws for non-numeric U8 literals", () => {
    expect(() => executeTuff("abcU8")).toThrow("Invalid U8 literal");
  });
});
