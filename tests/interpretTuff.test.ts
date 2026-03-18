import { interpretTuff } from "../src/interpretTuff";

describe("interpretTuff", () => {
  test("interpretTuff(empty string) => 0", () => {
    const result = interpretTuff("");
    expect(result).toBe(0);
  });

  test("interpretTuff('100U8') => 100", () => {
    const result = interpretTuff("100U8");
    expect(result).toBe(100);
  });

  test("interpretTuff('-100U8') => Err", () => {
    expect(() => interpretTuff("-100U8")).toThrow(
      "Negative numbers are not allowed",
    );
  });

  // U8 tests
  test("interpretTuff('255U8') => 255", () => {
    expect(interpretTuff("255U8")).toBe(255);
  });

  test("interpretTuff('256U8') => Err (out of range)", () => {
    expect(() => interpretTuff("256U8")).toThrow();
  });

  // U16 tests
  test("interpretTuff('1000U16') => 1000", () => {
    expect(interpretTuff("1000U16")).toBe(1000);
  });

  test("interpretTuff('65535U16') => 65535", () => {
    expect(interpretTuff("65535U16")).toBe(65535);
  });

  test("interpretTuff('65536U16') => Err (out of range)", () => {
    expect(() => interpretTuff("65536U16")).toThrow();
  });

  // U32 tests
  test("interpretTuff('100000U32') => 100000", () => {
    expect(interpretTuff("100000U32")).toBe(100000);
  });

  test("interpretTuff('4294967295U32') => 4294967295", () => {
    expect(interpretTuff("4294967295U32")).toBe(4294967295);
  });

  test("interpretTuff('4294967296U32') => Err (out of range)", () => {
    expect(() => interpretTuff("4294967296U32")).toThrow();
  });

  // U64 tests
  test("interpretTuff('1000000U64') => 1000000", () => {
    expect(interpretTuff("1000000U64")).toBe(1000000);
  });

  // I8 tests
  test("interpretTuff('127I8') => 127", () => {
    expect(interpretTuff("127I8")).toBe(127);
  });

  test("interpretTuff('128I8') => Err (out of range)", () => {
    expect(() => interpretTuff("128I8")).toThrow();
  });

  // I16 tests
  test("interpretTuff('32767I16') => 32767", () => {
    expect(interpretTuff("32767I16")).toBe(32767);
  });

  test("interpretTuff('32768I16') => Err (out of range)", () => {
    expect(() => interpretTuff("32768I16")).toThrow();
  });

  // I32 tests
  test("interpretTuff('2147483647I32') => 2147483647", () => {
    expect(interpretTuff("2147483647I32")).toBe(2147483647);
  });

  test("interpretTuff('2147483648I32') => Err (out of range)", () => {
    expect(() => interpretTuff("2147483648I32")).toThrow();
  });

  // I64 tests
  test("interpretTuff('9223372036854775807I64') => 9223372036854775807", () => {
    expect(interpretTuff("9223372036854775807I64")).toBe(9223372036854775807);
  });

  // Error case: unknown type suffix
  test("interpretTuff('100U7') => Err (unknown type)", () => {
    expect(() => interpretTuff("100U7")).toThrow();
  });

  test("interpretTuff('100F32') => Err (unknown type)", () => {
    expect(() => interpretTuff("100F32")).toThrow();
  });
});
