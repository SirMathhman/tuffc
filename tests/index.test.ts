import { interpretTuff } from "../src/index";

describe("interpretTuff", () => {
  it.each([
    ["0U8", 0],
    ["255U8", 255],
    ["65535U16", 65535],
    ["4294967295U32", 4294967295],
    ["18446744073709551615U64", 18446744073709551615],
    ["-128I8", -128],
    ["127I8", 127],
    ["-32768I16", -32768],
    ["2147483647I32", 2147483647],
    ["-9223372036854775808I64", -9223372036854775808],
  ])("returns %s for %s", (input, expected) => {
    expect(interpretTuff(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["1U8 + 2U8", 3],
    ["7U16 - 3U8", 4],
    ["3U8 * 4U16", 12],
    ["9U8 / 3U16", 3],
    ["1U8 + 2I16", 3],
  ])("evaluates %s to %s", (input, expected) => {
    expect(interpretTuff(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    "",
    "foo",
    "100U9",
    "U8",
    "-1U8",
    "256U8",
    "65536U16",
    "4294967296U32",
    "18446744073709551616U64",
    "128I8",
    "-129I8",
    "32768I16",
    "2147483648I32",
    "9223372036854775808I64",
    "-9223372036854775809I64",
    "255U8 + 1U8",
    "1U8 / 0U8",
    "1U8 ^ 2U8",
  ])("returns an error for invalid input %s", (input) => {
    expect(interpretTuff(input).ok).toBe(false);
  });
});
