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
    ["1U8 == 1U8", 1],
    ["1U8 != 2U8", 1],
    ["1U8 < 2U8", 1],
    ["2U8 <= 2U8", 1],
    ["3U8 > 2U8", 1],
    ["3U8 >= 3U8", 1],
    ["true == true", 1],
    ["true != false", 1],
    ["let x : I32 = 100; let y : *I32 = &x; let z : *I32 = &x; y == z", 1],
    [
      "let x : I32 = 100; let y : *I32 = &x; let z : I32 = 200; let w : *I32 = &z; y != w",
      1,
    ],
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

  it("returns an error when comparison mixes Bool and numeric values", () => {
    expectErrorKind("true == 1U8", "InvalidPointer");
  });

  it("returns an error when relational comparison uses Bool operands", () => {
    expectErrorKind("true < false", "InvalidPointer");
  });

  it("returns an error when relational comparison uses pointer operands", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *I32 = &x; y < y",
      "InvalidPointer",
    );
  });

  it("returns an error when pointer comparison uses unsupported operator", () => {
    expectErrorKind(
      "let x : I32 = 100; let y : *I32 = &x; y >= y",
      "InvalidPointer",
    );
  });

  it("returns an error when comparison left operand cannot be resolved", () => {
    expectErrorKind("missingLeft == 1U8", "UndefinedVariable");
  });

  it("returns an error when comparison right operand cannot be resolved", () => {
    expectErrorKind("1U8 == missingRight", "UndefinedVariable");
  });

  it("returns an error for chained comparison operators", () => {
    expectErrorKind("1U8 < 2U8 < 3U8", "UnsupportedInput");
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

  it("evaluates an if-expression in a let initializer", () => {
    expectOkValue("let x = if (true) 3 else 5; x", 3);
  });

  it("evaluates an if-expression with false condition", () => {
    expectOkValue("let x = if (false) 3 else 5; x", 5);
  });

  it("evaluates an if-expression with block branches", () => {
    expectOkValue("let x = if (true) { 3 } else { 5 }; x", 3);
  });

  it("supports nested if-expressions", () => {
    expectOkValue("let x = if (true) if (false) 1 else 2 else 3; x", 2);
  });

  it("supports Bool-valued if-expressions", () => {
    expectOkValue("if (true) true else false", 1);
  });

  it("keeps bare if-else at top level as an if-expression", () => {
    expectOkValue("if (true) 1 else 2", 1);
  });

  it("evaluates pointer-typed if-expression branches with matching pointer types", () => {
    expectOkValue(
      "let x : I32 = 1; let y : *I32 = &x; let z : *I32 = &x; let p = if (true) y else z; *p",
      1,
    );
  });

  it("evaluates if-expression when outer scope has existing bindings", () => {
    expectOkValue("let y = 1U8; let x = if (true) y else y; x", 1);
  });

  it("evaluates if-expression when outer scope contains Bool binding", () => {
    expectOkValue("let flag : Bool = true; let x = if (true) 1 else 2; x", 1);
  });

  it("evaluates if-expression inside nested block scope", () => {
    expectOkValue("let a = 1; { let b = 2; if (true) b else b }", 2);
  });

  it("evaluates if-expression with nested delimiters in block branch", () => {
    expectOkValue("if (true) { { 1 } } else 2", 1);
  });

  it("returns an error when if condition is not Bool", () => {
    expectErrorKind("if (1U8) 3 else 5", "InvalidPointer");
  });

  it("returns an error when if branches have different types", () => {
    expectErrorKind("if (true) 3 else false", "InvalidPointer");
  });

  it("returns an error when if-expression omits else in expression context", () => {
    expectErrorKind("let x = if (true) 3; x", "UnsupportedInput");
  });

  it("returns an error when if-expression condition cannot be resolved", () => {
    expectErrorKind("if (missingFlag) 3 else 5", "UndefinedVariable");
  });

  it("returns an error when selected if branch expression fails", () => {
    expectErrorKind("if (true) missingValue else 5", "UndefinedVariable");
  });

  it("returns an error when if-expression does not use if keyword boundary", () => {
    expectErrorKind("ifx (true) 3 else 5", "UnsupportedInput");
  });

  it("returns an error when if-expression omits required whitespace after if", () => {
    expectErrorKind("if(true) 3 else 5", "UnsupportedInput");
  });

  it("returns an error when if-expression in expression context omits required whitespace after if", () => {
    expectErrorKind("let x = if(true) 3 else 5; x", "UnsupportedInput");
  });

  it("returns an error for malformed if-expression with missing condition delimiter", () => {
    expectErrorKind("if (true 3 else 5", "UnsupportedInput");
  });

  it("returns an error for malformed if-expression in expression context with missing condition delimiter", () => {
    expectErrorKind("let x = if (true 3 else 5; x", "UnsupportedInput");
  });

  it("returns an error for empty if-expression condition", () => {
    expectErrorKind("if () 3 else 5", "UnsupportedInput");
  });

  it("returns an error for empty if-expression condition in expression context", () => {
    expectErrorKind("let x = if () 3 else 5; x", "UnsupportedInput");
  });

  it("returns an error for incomplete if-expression after condition", () => {
    expectErrorKind("if (true)", "UnsupportedInput");
  });

  it("returns an error for incomplete if-expression in expression context", () => {
    expectErrorKind("let x = if (true); x", "UnsupportedInput");
  });

  it("returns an error for if-expression with empty then-branch", () => {
    expectErrorKind("if (true) else 5", "UnsupportedInput");
  });

  it("returns an error for if-expression with empty then-branch in expression context", () => {
    expectErrorKind("let x = if (true) else 5; x", "UnsupportedInput");
  });

  it("returns an error for if-expression with empty else-branch whitespace", () => {
    expectErrorKind("if (true) 3 else   ", "UnsupportedInput");
  });

  it("returns an error for if-expression with empty else-branch in expression context", () => {
    expectErrorKind("let x = if (true) 3 else; x", "UnsupportedInput");
  });

  it("returns an error for malformed if-expression condition grouping", () => {
    expectErrorKind("if true 3 else 5", "UnsupportedInput");
  });

  it("returns an error for malformed if-expression in expression context without condition grouping", () => {
    expectErrorKind("let x = if true 3 else 5; x", "UnsupportedInput");
  });

  it("returns an error when if-expression condition uses unsupported nested grouping", () => {
    expectErrorKind("if ((true)) 3 else 5", "UnsupportedInput");
  });

  it("executes a bare if-statement for side effects", () => {
    expectOkValue("let mut x = 0; if (true) x = 3; x", 3);
  });

  it("executes a braced if-statement else branch for side effects", () => {
    expectOkValue("let mut x = 0; if (false) { x = 3; } else { x = 5; } x", 5);
  });

  it("does not execute a bare if-statement when condition is false", () => {
    expectOkValue("let mut x = 1; if (false) x = 2; x", 1);
  });

  it("returns 0 when the program ends with an if-statement", () => {
    expectOkValue("if (true) { 3 }", 0);
  });

  it("ignores errors in the non-selected if-statement branch", () => {
    expectOkValue(
      "let mut x = 0; if (true) { x = 1; } else { missing = 2; } x",
      1,
    );
  });

  it("executes if-statements inside nested blocks", () => {
    expectOkValue("let mut x = 0; { if (true) { x = 7; }; 0 } x", 7);
  });

  it("returns an error when if-statement condition is not Bool", () => {
    expectErrorKind("let mut x = 0; if (1U8) x = 1; x", "InvalidPointer");
  });

  it("returns an error when if-statement condition cannot be resolved", () => {
    expectErrorKind("if (missingFlag) { 1 }", "UndefinedVariable");
  });

  it("returns an error when selected if-statement branch fails", () => {
    expectErrorKind(
      "let mut x = 0; if (true) missing = 1; x",
      "UndefinedVariable",
    );
  });

  it("returns an error for incomplete if-statement after condition", () => {
    expectErrorKind("if (true)", "UnsupportedInput");
  });

  it("returns an error for if-statement with empty then-branch before else", () => {
    expectErrorKind("if (true) else { 1 }", "UnsupportedInput");
  });

  it("returns an error for braced if-statement else with empty else-branch", () => {
    expectErrorKind("if (true) { 1 } else", "UnsupportedInput");
  });

  it("evaluates assignment inside a block and updates outer mutable variable", () => {
    expectOkValue("let mut x = 0; { x = 100; } x", 100);
  });

  it("evaluates nested blocks and updates outer mutable variable", () => {
    expectOkValue("let mut x = 0; { { x = 100; } } x", 100);
  });

  it("evaluates a block to the value of its last statement", () => {
    expectOkValue("{ let x : U8 = 1U8; x }", 1);
  });

  it("keeps block-local bindings scoped to the block", () => {
    expectErrorKind("{ let x : U8 = 1U8; x }; x", "UndefinedVariable");
  });

  it("supports shadowing in nested block scope", () => {
    expectOkValue("let x : U8 = 1U8; { let x : U8 = 2U8; x }; x", 1);
  });

  it("returns an error when assigning to immutable outer binding inside block", () => {
    expectErrorKind("let x = 0U8; { x = 100U8; } x", "ImmutableVariable");
  });

  it("returns an error for an empty block", () => {
    expectErrorKind("{}", "UnsupportedInput");
  });

  it("returns an error for a block whose statements produce no value", () => {
    expectErrorKind("let x = { if (true) 1; }; x", "UnsupportedInput");
  });

  it("returns an error for malformed nested block structure", () => {
    expectErrorKind("{{}", "UnsupportedInput");
  });

  it("returns an error for unmatched top-level braces", () => {
    expectErrorKind("let x = 1U8; { x = 2U8", "UnsupportedInput");
  });

  it("returns an error when multiple blocks are concatenated without separators", () => {
    expectErrorKind("{}{}", "UnsupportedInput");
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
    "}",
    "1=2",
    "x =",
    "*x =",
    "*123 = 100I8",
    "1U8 <",
    "*x == 100I8",
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
