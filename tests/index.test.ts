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
    ["true", 1],
    ["false", 0],
    ["!false", 1],
    ["!true", 0],
    ["true && true", 1],
    ["true && false", 0],
    ["false || true", 1],
    ["false || false", 0],
    ["let flag : Bool = true; flag", 1],
    ["let flag = false; !flag", 1],
    ["let mut flag : Bool = true; flag = false; flag", 0],
    ["let mut a : Bool = true; let b : Bool = false; a = a && !b; a", 1],
  ])("evaluates Bool expression %s to %s", (input, expected) => {
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
    "True",
    "False",
  ])("returns an error for invalid input %s", (input) => {
    expect(interpretTuff(input).ok).toBe(false);
  });

  it("returns an error when assigning Bool to a numeric binding", () => {
    expectErrorKind("let x : U8 = true; x", "InvalidPointer");
  });

  it("returns an error when assigning numeric to a Bool binding", () => {
    expectErrorKind("let x : Bool = 1U8; x", "InvalidPointer");
  });

  it("returns an error when arithmetic mixes Bool and numeric values", () => {
    expectErrorKind("true + 1U8", "InvalidPointer");
  });

  it("returns an error when unary not is used with numeric value", () => {
    expectErrorKind("!1U8", "InvalidPointer");
  });

  it("returns an error when unary not operand cannot be resolved", () => {
    expectErrorKind("!missingBool", "UndefinedVariable");
  });

  it("returns an error when logical and mixes numeric and Bool values", () => {
    expectErrorKind("1U8 && true", "InvalidPointer");
  });

  it("returns an error when logical and left operand cannot be resolved", () => {
    expectErrorKind("missingLeft && true", "UndefinedVariable");
  });

  it("returns an error when logical and right operand cannot be resolved", () => {
    expectErrorKind("true && missingRight", "UndefinedVariable");
  });

  it("returns an error when reassigning a Bool variable with numeric value", () => {
    expectErrorKind(
      "let mut flag : Bool = true; flag = 1U8; flag",
      "InvalidPointer",
    );
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

  it("returns an error when a let initializer underflows the declared type", () => {
    expectErrorKind("let x : U8 = -1I8; x", "OutOfBounds");
  });

  it("returns an error when a numeric let binding receives a pointer initializer", () => {
    expectErrorKind("let y : I32 = 100; let x : U8 = &y; x", "InvalidPointer");
  });

  it("returns an error when a mutable assignment underflows the declared type", () => {
    expectErrorKind("let mut x : U8 = 1U8; x = -1I8; x", "OutOfBounds");
  });

  it("returns an error when arithmetic uses a pointer operand", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *I32 = &x; y + 1I32",
      "InvalidPointer",
    );
  });

  it("returns an error when assigning a pointer to a numeric binding", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let y : *I32 = &x; x = y; x",
      "InvalidPointer",
    );
  });

  it("evaluates a mutable pointer binding reassigned to the same address", () => {
    expect(
      interpretTuff("let x : I32 = 100; let mut y : *I32 = &x; y = &x; *y"),
    ).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("returns an error when assigning a numeric value to a pointer binding", () => {
    expectErrorKind(
      "let x : I32 = 100; let mut y : *I32 = &x; y = 100; y",
      "InvalidPointer",
    );
  });

  it("returns an error when assigning a pointer with a mismatched target type", () => {
    expectErrorKind(
      "let x : I32 = 100; let mut y : *I32 = &x; let z : I64 = 200; y = &z; y",
      "InvalidPointer",
    );
  });

  it("evaluates a pointer binding and dereference", () => {
    expect(interpretTuff("let x : I32 = 100; let y : *I32 = &x; *y")).toEqual({
      ok: true,
      value: 100,
    });
  });

  it("evaluates a pointer binding across multiple statements and lines", () => {
    expect(interpretTuff("let x : I32 = 100;\nlet y : *I32 = &x;\n*y")).toEqual(
      {
        ok: true,
        value: 100,
      },
    );
  });

  it("returns an error when dereferencing a non-pointer", () => {
    expectErrorKind("let x : I32 = 100; *x", "InvalidPointer");
  });

  it("returns an error when taking the address of an undefined variable", () => {
    expectErrorKind("let y : *I32 = &x; y", "UndefinedVariable");
  });

  it("returns an error when the final value is a pointer", () => {
    expectErrorKind("let x : I32 = 100; &x", "InvalidPointer");
  });

  it("returns an error when taking the address of a pointer variable", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *I32 = &x; &y",
      "InvalidPointer",
    );
  });

  it("returns an error when a pointer let binding targets the wrong type", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *I64 = &x; y",
      "InvalidPointer",
    );
  });

  it("returns an error when dereferencing a non-identifier operand", () => {
    expectErrorKind("*&x", "InvalidPointer");
  });

  it("returns an error when declaring an unsupported pointer suffix", () => {
    expectErrorKind("let y : *U9 = 100", "UnsupportedSuffix");
  });

  it("evaluates a mutable pointer with dereference assignment", () => {
    expectOkValue(
      "let mut x : I32 = 0; let y : *mut I32 = &mut x; *y = 100; x",
      100,
    );
  });

  it("evaluates multiple dereference assignments through the same mutable pointer", () => {
    expectOkValue(
      "let mut x : I32 = 0; let y : *mut I32 = &mut x; *y = 50; *y = 100; x",
      100,
    );
  });

  it("returns an error when assigning through an immutable pointer", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let y : *I32 = &mut x; *y = 200; x",
      "InvalidPointer",
    );
  });

  it("returns an error when dereferencing and assigning with type mismatch", () => {
    expectErrorKind(
      "let mut x : I16 = 100; let y : *mut I32 = &mut x; *y = 50000I32; x",
      "InvalidPointer",
    );
  });

  it("returns an error when assigning non-&mut to a *mut binding", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let y : *mut I32 = &x; y",
      "InvalidPointer",
    );
  });

  it("returns an error when assigning through a non-mutable pointer variable", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let mut y : *I32 = &mut x; *y = 200; x",
      "InvalidPointer",
    );
  });

  it("returns an error when the target is not mutable during dereference assignment", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *mut I32 = &mut x; *y = 200; x",
      "InvalidPointer",
    );
  });

  it("returns an error when reassigning an immutable pointer binding", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let mut z : I32 = 200; let y : *mut I32 = &mut x; y = &mut z; y",
      "ImmutableVariable",
    );
  });

  it("returns an error when dereferencing and assigning to a pointer with invalid target", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let mut y : *mut I32 = &mut x; let z : I32 = 200; y = &mut z; *y = 50I32; x",
      "InvalidPointer",
    );
  });

  it("returns an error when assigning through pointer overflows target type", () => {
    expectErrorKind(
      "let mut x : I8 = 100; let y : *mut I8 = &mut x; *y = 128I32; x",
      "OutOfBounds",
    );
  });

  it("returns an error when assigning a pointer value through dereference", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let y : *mut I32 = &mut x; let z : I32 = 200; let w : *I32 = &z; *y = w; x",
      "InvalidPointer",
    );
  });

  it("returns an error when dereferencing an undefined pointer", () => {
    expectErrorKind("*undefined = 100I32", "UndefinedVariable");
  });

  it("returns an error when dereferencing a non-pointer in assignment", () => {
    expectErrorKind("let x : I32 = 100; *x = 200I32; x", "InvalidPointer");
  });

  it("returns an error when assigning immutable pointer to mutable binding", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let mut y : *mut I32 = &mut x; let z : I32 = 200; let w : *I32 = &z; y = w; y",
      "InvalidPointer",
    );
  });

  it("returns an error for underflow in dereference assignment", () => {
    expectErrorKind(
      "let mut x : U8 = 0; let y : *mut U8 = &mut x; *y = -1I8; x",
      "OutOfBounds",
    );
  });

  it("returns an error when assigning pointer through dereference", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let mut y : *mut I32 = &mut x; let mut z : I32 = 200; let w : *I32 = &z; *y = w; x",
      "InvalidPointer",
    );
  });

  it("returns an error when dereference assignment value expression fails", () => {
    expectErrorKind(
      "let mut x : I32 = 100; let y : *mut I32 = &mut x; *y = 1U8 / 0U8; x",
      "DivisionByZero",
    );
  });

  it("returns an error when taking mutable address of immutable variable", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *mut I32 = &mut x; y",
      "InvalidPointer",
    );
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
    "let y : *I32 = 100",
    "let y : *I32 = x",
    "*x",
    "&100",
    "1=2",
    "x =",
    "*x =",
    "*123 = 100I8",
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
