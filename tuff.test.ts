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

  it("throws for plain garbage text", () => {
    expect(() => executeTuff("random garbage")).toThrow("Invalid Tuff source");
  });

  it("throws for symbol garbage", () => {
    expect(() => executeTuff("???")).toThrow("Invalid Tuff source");
  });

  it("throws for alphanumeric garbage", () => {
    expect(() => executeTuff("asdf123")).toThrow("Invalid Tuff source");
  });

  it("returns stdin value for read<U8>()", () => {
    expect(executeTuff("read<U8>()", "100")).toBe(100);
  });

  it("returns sum of two read<U8>() calls", () => {
    expect(executeTuff("read<U8>() + read<U8>()", "100 50")).toBe(150);
  });

  it("returns sum of three read<U8>() calls", () => {
    expect(executeTuff("read<U8>() + read<U8>() + read<U8>()", "1 2 3")).toBe(
      6,
    );
  });

  it("supports mixing read<U8>() with U8 literals", () => {
    expect(executeTuff("read<U8>() + 5U8 + read<U8>()", "10 20")).toBe(35);
  });

  it("throws for non-addition expression syntax", () => {
    expect(() => executeTuff("read<U8>() - read<U8>()", "100 50")).toThrow(
      "Invalid Tuff source",
    );
  });
});
