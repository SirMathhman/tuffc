import { interpretTuff, main } from "../src/index";

function expectOkValue(input: string, expected: number): void {
  expect(interpretTuff(input)).toEqual({ ok: true, value: expected });
}

function expectErrorKind(input: string, kind: string): void {
  const result = interpretTuff(input);

  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(result.error.kind).toBe(kind);
  }
}

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
    expectOkValue(input, expected);
  });

  it.each([
    ["1U8 + 2U8", 3],
    ["7U16 - 3U8", 4],
    ["3U8 * 4U16", 12],
    ["9U8 / 3U16", 3],
    ["1U8 + 2I16", 3],
    ["1I8 + 1I8", 2],
    ["1U32 + 1U32", 2],
    ["1I32 + 1I32", 2],
    ["1U64 + 1U64", 2],
    ["1I64 + 1I64", 2],
  ])("evaluates %s to %s", (input, expected) => {
    expectOkValue(input, expected);
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

  it("includes detailed error metadata", () => {
    const result = interpretTuff("foo");

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toEqual(
        expect.objectContaining({
          sourceCode: "foo",
          message: expect.any(String),
          reason: expect.any(String),
          suggestedFix: expect.any(String),
        }),
      );
    }
  });

  it("evaluates a typed let binding followed by a variable reference", () => {
    expect(interpretTuff("let x : U8 = 100U8; x")).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("evaluates the same let binding across multiple lines", () => {
    expect(interpretTuff("let x : U8 = 100U8;\nx")).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("ignores empty statements between semicolons", () => {
    expect(interpretTuff("let x : U8 = 100U8;; x")).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("evaluates a let binding with an expression initializer", () => {
    expect(interpretTuff("let total : U8 = 1U8 + 2U8; total")).toEqual({
      ok: true,
      value: 3,
    });
  });

  it("evaluates a mutable binding reassigned before the final expression", () => {
    expect(interpretTuff("let mut x = 0U8; x = 100U8; x")).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("evaluates a mutable binding reassigned with an expression", () => {
    expect(interpretTuff("let mut x = 1U8; x = 2U8 + 3U8; x")).toEqual({
      ok: true,
      value: 5,
    });
  });

  it("returns an error when assigning to an immutable binding", () => {
    expectErrorKind("let x = 0U8; x = 100U8; x", "ImmutableVariable");
  });

  it("returns an error when assigning to an undefined variable", () => {
    expectErrorKind("x = 100U8", "UndefinedVariable");
  });

  it("returns an error when a mutable assignment references an undefined variable", () => {
    expectErrorKind("let mut x = 0U8; x = y; x", "UndefinedVariable");
  });

  it("returns an error when a mutable assignment overflows the declared type", () => {
    expectErrorKind("let mut x = 0U8; x = 256U16; x", "OutOfBounds");
  });

  it("returns an error when a variable is referenced before definition", () => {
    expectErrorKind("x", "UndefinedVariable");
  });

  it("returns an error when a let initializer references an undefined variable", () => {
    expectErrorKind("let x : U8 = y; x", "UndefinedVariable");
  });

  it("returns an error when a let assignment overflows the declared type", () => {
    expectErrorKind("let x : U8 = 255U16 + 1U16; x", "OutOfBounds");
  });

  it.each([
    "let x : U8 x",
    "let x : U8 =",
    "1foo",
    "-U8",
    "x + 1U8",
    "1U8 + y",
    "+1U8",
    "  + 1U8",
    "1U8 +   ",
    "letx : U8 = 1U8",
    "let mutx = 1U8",
    "let 1x : U8 = 1U8",
    "let x U8 = 1U8",
    "let x : = 1U8",
    "let x : U9 = 1U8",
  ])("returns an error for malformed or unresolved input %s", (input) => {
    const result = interpretTuff(input);

    expect(result.ok).toBe(false);
  });

  it("prints the greeting from main", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    main();

    expect(spy).toHaveBeenCalledWith("Hello from TypeScript!");

    spy.mockRestore();
  });
});
