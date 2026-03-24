import { describe, expect, test } from "bun:test";
import { interpretTuff } from "../src/index";

describe("interpretTuff", () => {
  test("returns a number", () => {
    expect(interpretTuff("any input")).toBe(0);
  });

  test("returns 0 for an empty string", () => {
    expect(interpretTuff("")).toBe(0);
  });

  test("returns the leading integer prefix", () => {
    expect(interpretTuff("100U8")).toBe(100);
  });

  test("rejects negative numeric prefixes", () => {
    expect(() => interpretTuff("-100U8")).toThrow();
  });

  test("returns a negative value for signed I8 input", () => {
    expect(interpretTuff("-100I8")).toBe(-100);
  });

  test("returns a negative value for signed I16 input", () => {
    expect(interpretTuff("-100I16")).toBe(-100);
  });

  test("rejects U8 values above 255", () => {
    expect(() => interpretTuff("256U8")).toThrow();
  });

  test("rejects U16 values above 65535", () => {
    expect(() => interpretTuff("65536U16")).toThrow();
  });

  test("supports the upper bounds for unsigned widths", () => {
    expect(interpretTuff("255U8")).toBe(255);
    expect(interpretTuff("65535U16")).toBe(65535);
    expect(interpretTuff("4294967295U32")).toBe(4294967295);
    expect(interpretTuff("18446744073709551615U64")).toBe(18446744073709552000);
  });

  test("rejects unsigned values above their bounds", () => {
    expect(() => interpretTuff("256U8")).toThrow();
    expect(() => interpretTuff("65536U16")).toThrow();
    expect(() => interpretTuff("4294967296U32")).toThrow();
    expect(() => interpretTuff("18446744073709551616U64")).toThrow();
  });

  test("supports signed bounds", () => {
    expect(interpretTuff("127I8")).toBe(127);
    expect(interpretTuff("-128I8")).toBe(-128);
    expect(interpretTuff("32767I16")).toBe(32767);
    expect(interpretTuff("-32768I16")).toBe(-32768);
    expect(interpretTuff("2147483647I32")).toBe(2147483647);
    expect(interpretTuff("-2147483648I32")).toBe(-2147483648);
    expect(interpretTuff("9223372036854775807I64")).toBe(9223372036854776000);
    expect(interpretTuff("-9223372036854775808I64")).toBe(-9223372036854776000);
  });

  test("rejects signed values outside their bounds", () => {
    expect(() => interpretTuff("128I8")).toThrow();
    expect(() => interpretTuff("-129I8")).toThrow();
    expect(() => interpretTuff("32768I16")).toThrow();
    expect(() => interpretTuff("-32769I16")).toThrow();
    expect(() => interpretTuff("2147483648I32")).toThrow();
    expect(() => interpretTuff("-2147483649I32")).toThrow();
    expect(() => interpretTuff("9223372036854775808I64")).toThrow();
    expect(() => interpretTuff("-9223372036854775809I64")).toThrow();
  });
});
