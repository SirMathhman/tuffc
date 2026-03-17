import { compileTuff, executeTuff } from "./tuff";

describe("executeTuff", () => {
  it("compileTuff uses default stdin parameter when omitted", () => {
    expect(compileTuff("1U8")).toBe("(() => 1)()");
  });

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

  describe("multiple integer types", () => {
    it.each([
      ["123U16", 123],
      ["123U32", 123],
      ["123U64", 123],
      ["-12I8", -12],
      ["-123I16", -123],
      ["-123I32", -123],
      ["-123I64", -123],
    ])("parses valid typed literal %s", (source, expected) => {
      expect(executeTuff(source)).toBe(expected);
    });

    it.each([
      ["256U8", "U8 literal out of range"],
      ["65536U16", "U16 literal out of range"],
      ["4294967296U32", "U32 literal out of range"],
      ["18446744073709551616U64", "U64 literal out of range"],
      ["128I8", "I8 literal out of range"],
      ["32768I16", "I16 literal out of range"],
      ["2147483648I32", "I32 literal out of range"],
      ["9223372036854775808I64", "I64 literal out of range"],
      ["-129I8", "I8 literal out of range"],
      ["-32769I16", "I16 literal out of range"],
      ["-2147483649I32", "I32 literal out of range"],
      ["-9223372036854775809I64", "I64 literal out of range"],
      ["-1U16", "U16 literal out of range"],
      ["-1U32", "U32 literal out of range"],
      ["-1U64", "U64 literal out of range"],
    ])("throws for out-of-range literal %s", (source, expectedMessage) => {
      expect(() => executeTuff(source)).toThrow(expectedMessage);
    });

    it.each([
      ["read<U16>()", "600", 600],
      ["read<I16>()", "-12", -12],
      ["read<I32>() + read<U16>()", "-10 20", 10],
      ["read<U32>() + 5I16 + read<I8>()", "100 20", 125],
      ["1U8 + 2I16 + read<U64>()", "3", 6],
    ])("supports typed read/expression %s", (source, stdIn, expected) => {
      expect(executeTuff(source, stdIn)).toBe(expected);
    });

    it.each([
      ["read<U16>()", "abc"],
      ["read<I16>()", "12.5"],
      ["read<I8>()", ""],
      ["read<I8>()", "128"],
      ["read<U8>()", "-1"],
      ["read<U16>() + 1U8", "70000"],
    ])("throws for invalid typed stdin in %s", (source, stdIn) => {
      expect(() => executeTuff(source, stdIn)).toThrow("Invalid integer stdin");
    });

    it("throws Invalid U8 literal for malformed U8 term in addition", () => {
      expect(() => executeTuff("badU8 + 1U8")).toThrow("Invalid U8 literal");
    });

    it("throws Invalid Tuff source for malformed non-U8 suffix term", () => {
      expect(() => executeTuff("badI16")).toThrow("Invalid Tuff source");
    });

    it("throws Invalid Tuff source for malformed non-U8 suffix in addition", () => {
      expect(() => executeTuff("badI16 + 1U8")).toThrow("Invalid Tuff source");
    });

    it("throws Invalid Tuff source for unknown bare term in addition", () => {
      expect(() => executeTuff("foo + 1U8")).toThrow("Invalid Tuff source");
    });

    it("throws for missing stdin token in multi-read expression", () => {
      expect(() => executeTuff("read<U16>() + read<U16>()", "10")).toThrow(
        "Invalid integer stdin",
      );
    });
  });
});
