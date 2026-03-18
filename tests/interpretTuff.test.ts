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

// ── Expression evaluation tests ────────────────────────────────────────────────

describe("interpretTuff expressions", () => {
  // Basic addition
  test("Simple addition: 100U8 + 2U8 => 102", () => {
    expect(interpretTuff("100U8 + 2U8")).toBe(102);
  });

  test("Addition with no spaces: 100U8+2U8 => 102", () => {
    expect(interpretTuff("100U8+2U8")).toBe(102);
  });

  test("Addition: 50U16 + 100U16 => 150", () => {
    expect(interpretTuff("50U16 + 100U16")).toBe(150);
  });

  test("Addition at boundary: 254U8 + 1U8 => 255", () => {
    expect(interpretTuff("254U8 + 1U8")).toBe(255);
  });

  test("Addition overflow U8: 255U8 + 1U8 => Err", () => {
    expect(() => interpretTuff("255U8 + 1U8")).toThrow();
  });

  // Basic subtraction
  test("Subtraction: 100U8 - 50U8 => 50", () => {
    expect(interpretTuff("100U8 - 50U8")).toBe(50);
  });

  test("Subtraction at boundary: 1U8 - 1U8 => 0", () => {
    expect(interpretTuff("1U8 - 1U8")).toBe(0);
  });

  test("Subtraction underflow U8: 0U8 - 1U8 => Err (negative result)", () => {
    expect(() => interpretTuff("0U8 - 1U8")).toThrow();
  });

  test("Subtraction underflow U8: 50U8 - 100U8 => Err (negative result)", () => {
    expect(() => interpretTuff("50U8 - 100U8")).toThrow();
  });

  // Basic multiplication
  test("Multiplication: 10U8 * 5U8 => 50", () => {
    expect(interpretTuff("10U8 * 5U8")).toBe(50);
  });

  test("Multiplication: 20U16 * 30U16 => 600", () => {
    expect(interpretTuff("20U16 * 30U16")).toBe(600);
  });

  test("Multiplication overflow: 200U8 * 2U8 => Err", () => {
    expect(() => interpretTuff("200U8 * 2U8")).toThrow();
  });

  // Basic division
  test("Division: 100U8 / 2U8 => 50", () => {
    expect(interpretTuff("100U8 / 2U8")).toBe(50);
  });

  test("Integer division: 7U8 / 2U8 => 3", () => {
    expect(interpretTuff("7U8 / 2U8")).toBe(3);
  });

  test("Division by zero: 100U8 / 0U8 => Err", () => {
    expect(() => interpretTuff("100U8 / 0U8")).toThrow();
  });

  // Order of operations
  test("Precedence: 2U8 + 3U8 * 4U8 => 14", () => {
    expect(interpretTuff("2U8 + 3U8 * 4U8")).toBe(14);
  });

  test("Precedence: 10U8 - 2U8 * 3U8 => 4", () => {
    expect(interpretTuff("10U8 - 2U8 * 3U8")).toBe(4);
  });

  test("Precedence: 100U8 / 2U8 + 30U8 => 80", () => {
    expect(interpretTuff("100U8 / 2U8 + 30U8")).toBe(80);
  });

  test("Precedence: 30U8 + 100U8 / 2U8 => 80", () => {
    expect(interpretTuff("30U8 + 100U8 / 2U8")).toBe(80);
  });

  // Parentheses
  test("Parentheses: (2U8 + 3U8) * 4U8 => 20", () => {
    expect(interpretTuff("(2U8 + 3U8) * 4U8")).toBe(20);
  });

  test("Parentheses: (100U8 - 20U8) / 2U8 => 40", () => {
    expect(interpretTuff("(100U8 - 20U8) / 2U8")).toBe(40);
  });

  test("Nested parentheses: ((2U8 + 3U8) * 4U8) / 2U8 => 10", () => {
    expect(interpretTuff("((2U8 + 3U8) * 4U8) / 2U8")).toBe(10);
  });

  // Type widening
  test("Type widening U8 + U16: 50U8 + 100U16 => 150 (widest type U16)", () => {
    expect(interpretTuff("50U8 + 100U16")).toBe(150);
  });

  test("Type widening U16 + U32: 1000U16 + 5000U32 => 6000 (widest type U32)", () => {
    expect(interpretTuff("1000U16 + 5000U32")).toBe(6000);
  });

  test("Type widening multiple: 10U8 + 20U16 + 30U32 => 60 (widest type U32)", () => {
    expect(interpretTuff("10U8 + 20U16 + 30U32")).toBe(60);
  });

  test("Type widening chain in expression: (5U8 + 10U16) * 2U8 => 30", () => {
    expect(interpretTuff("(5U8 + 10U16) * 2U8")).toBe(30);
  });

  // Whitespace handling
  test("Extra spaces: 100U8  +   2U8 => 102", () => {
    expect(interpretTuff("100U8  +   2U8")).toBe(102);
  });

  test("Mixed spacing: 50U8+ 100U8 => 150", () => {
    expect(interpretTuff("50U8+ 100U8")).toBe(150);
  });

  // Edge cases with range validation
  test("Result within widest operand type: 200U8 + 50U8 with widened range", () => {
    expect(interpretTuff("200U8 + 50U8")).toBe(250);
  });

  test("Underflow with subtraction when widened: 100U8 - 200U16 => Err (negative)", () => {
    expect(() => interpretTuff("100U8 - 200U16")).toThrow();
  });
});

describe("interpretTuff let statements", () => {
  // Basic let statement tests
  test("let > simple declaration and reference: let x = 5U8; x => 5", () => {
    expect(interpretTuff("let x = 5U8; x")).toBe(5);
  });

  test("let > declaration with explicit type: let x : U8 = 10U8; x => 10", () => {
    expect(interpretTuff("let x : U8 = 10U8; x")).toBe(10);
  });

  test("let > type inference from literal: let x = 20U16; x => 20", () => {
    expect(interpretTuff("let x = 20U16; x")).toBe(20);
  });

  test("let > simple arithmetic with declared variable: let x = 5U8; x + 3U8 => 8", () => {
    expect(interpretTuff("let x = 5U8; x + 3U8")).toBe(8);
  });

  test("let > chaining multiple let statements: let x = 1U8; let y = 2U8; x + y => 3", () => {
    expect(interpretTuff("let x = 1U8; let y = 2U8; x + y")).toBe(3);
  });

  test("let > three chained lets: let a = 10U8; let b = 20U8; let c = 30U8; a + b + c => 60", () => {
    expect(
      interpretTuff("let a = 10U8; let b = 20U8; let c = 30U8; a + b + c"),
    ).toBe(60);
  });

  test("let > referencing previous binding: let x = 5U8; let y = x; y => 5", () => {
    expect(interpretTuff("let x = 5U8; let y = x; y")).toBe(5);
  });

  test("let > using previous binding in expression: let x = 5U8; let y = x + 3U8; y => 8", () => {
    expect(interpretTuff("let x = 5U8; let y = x + 3U8; y")).toBe(8);
  });

  // Shadowing tests
  test("let > variable shadowing: let x = 5U8; let x = 10U8; x => 10", () => {
    expect(interpretTuff("let x = 5U8; let x = 10U8; x")).toBe(10);
  });

  test("let > shadowing with value from previous: let x = 5U8; let x = x + 1U8; x => 6", () => {
    expect(interpretTuff("let x = 5U8; let x = x + 1U8; x")).toBe(6);
  });

  // Type inference tests
  test("let > infer U8 from expression: let result = 50U8 + 25U8; result => 75", () => {
    expect(interpretTuff("let result = 50U8 + 25U8; result")).toBe(75);
  });

  test("let > infer U16 from widened expression: let sum = 100U8 + 1000U16; sum => 1100", () => {
    expect(interpretTuff("let sum = 100U8 + 1000U16; sum")).toBe(1100);
  });

  // Complex expressions with let
  test("let > arithmetic in declaration: let x = 2U8 * 3U8; x => 6", () => {
    expect(interpretTuff("let x = 2U8 * 3U8; x")).toBe(6);
  });

  test("let > parentheses in let binding: let x = (2U8 + 3U8) * 4U8; x => 20", () => {
    expect(interpretTuff("let x = (2U8 + 3U8) * 4U8; x")).toBe(20);
  });

  test("let > precedence in let binding: let x = 2U8 + 3U8 * 4U8; x => 14", () => {
    expect(interpretTuff("let x = 2U8 + 3U8 * 4U8; x")).toBe(14);
  });

  test("let > multiple operations: let x = 10U8; let y = x * 2U8; let z = y + 5U8; z => 25", () => {
    expect(
      interpretTuff("let x = 10U8; let y = x * 2U8; let z = y + 5U8; z"),
    ).toBe(25);
  });

  // Error cases: undefined variables
  test("let > error on undefined variable reference: let x = y; => Err", () => {
    expect(() => interpretTuff("let x = y;")).toThrow();
  });

  test("let > error on undefined in expression: let x = 5U8; let y = x + z; => Err", () => {
    expect(() => interpretTuff("let x = 5U8; let y = x + z;")).toThrow();
  });

  test("let > error referencing undefined final expression: let x = 5U8; y => Err", () => {
    expect(() => interpretTuff("let x = 5U8; y")).toThrow();
  });

  // Error cases: type mismatches and range violations
  test("let > error on overflow in let binding: let x = 300U8; => Err", () => {
    expect(() => interpretTuff("let x = 300U8;")).toThrow();
  });

  test("let > error on result overflow: let x = 200U8; let y = x + 100U8; y => Err", () => {
    expect(() =>
      interpretTuff("let x = 200U8; let y = x + 100U8; y"),
    ).toThrow();
  });

  // Whitespace variations
  test("let > extra whitespace: let   x   =   5U8   ;   x => 5", () => {
    expect(interpretTuff("let   x   =   5U8   ;   x")).toBe(5);
  });

  test("let > minimal whitespace: let x=5U8;x => 5", () => {
    expect(interpretTuff("let x=5U8;x")).toBe(5);
  });

  test("let > newlines in let block (if supported): let x = 5U8; let y = 10U8; x + y => 15", () => {
    expect(interpretTuff("let x = 5U8; let y = 10U8; x + y")).toBe(15);
  });

  // Mixed operations
  test("let > division in let: let x = 100U8 / 4U8; x => 25", () => {
    expect(interpretTuff("let x = 100U8 / 4U8; x")).toBe(25);
  });

  test("let > subtraction in let: let x = 100U8 - 50U8; x => 50", () => {
    expect(interpretTuff("let x = 100U8 - 50U8; x")).toBe(50);
  });

  test("let > multiple operations chain: let a = 2U8; let b = a + 3U8; let c = b * 2U8; c => 10", () => {
    expect(
      interpretTuff("let a = 2U8; let b = a + 3U8; let c = b * 2U8; c"),
    ).toBe(10);
  });

  // Type annotation with inference
  test("let > explicit type U16: let x : U16 = 100U8; x => 100", () => {
    expect(interpretTuff("let x : U16 = 100U8; x")).toBe(100);
  });

  test("let > explicit type matches result: let x : U32 = 100U8 + 1000U16; x => 1100", () => {
    expect(interpretTuff("let x : U32 = 100U8 + 1000U16; x")).toBe(1100);
  });

  // Edge cases
  test("let > zero value: let x = 0U8; x => 0", () => {
    expect(interpretTuff("let x = 0U8; x")).toBe(0);
  });

  test("let > max value U8: let x = 255U8; x => 255", () => {
    expect(interpretTuff("let x = 255U8; x")).toBe(255);
  });

  test("let > max value U16: let x = 65535U16; x => 65535", () => {
    expect(interpretTuff("let x = 65535U16; x")).toBe(65535);
  });

  test("let > division by zero in let: let x = 10U8 / 0U8; => Err", () => {
    expect(() => interpretTuff("let x = 10U8 / 0U8;")).toThrow();
  });
});

describe("interpretTuff assignments", () => {
  // Basic mutable binding and assignment
  test("assignment > simple mutable binding: let mut x = 0U8; x => 0", () => {
    expect(interpretTuff("let mut x = 0U8; x")).toBe(0);
  });

  test("assignment > single assignment: let mut x = 0U8; x = 5U8; x => 5", () => {
    expect(interpretTuff("let mut x = 0U8; x = 5U8; x")).toBe(5);
  });

  test("assignment > assign and reference: let mut x = 10U8; x = 20U8; x => 20", () => {
    expect(interpretTuff("let mut x = 10U8; x = 20U8; x")).toBe(20);
  });

  // Multiple assignments
  test("assignment > multiple assignments: let mut x = 0U8; x = 1U8; x = 2U8; x => 2", () => {
    expect(interpretTuff("let mut x = 0U8; x = 1U8; x = 2U8; x")).toBe(2);
  });

  test("assignment > four reassignments: let mut x = 10U8; x = 20U8; x = 30U8; x = 40U8; x => 40", () => {
    expect(
      interpretTuff("let mut x = 10U8; x = 20U8; x = 30U8; x = 40U8; x"),
    ).toBe(40);
  });

  // Assignment in arithmetic
  test("assignment > use after assignment in expression: let mut x = 5U8; x = 10U8; x + 5U8 => 15", () => {
    expect(interpretTuff("let mut x = 5U8; x = 10U8; x + 5U8")).toBe(15);
  });

  test("assignment > assignment then multiplication: let mut x = 2U8; x = 3U8; x * 4U8 => 12", () => {
    expect(interpretTuff("let mut x = 2U8; x = 3U8; x * 4U8")).toBe(12);
  });

  test("assignment > multiple mutable variables: let mut x = 5U8; let mut y = 10U8; x = 15U8; y = 20U8; x + y => 35", () => {
    expect(
      interpretTuff(
        "let mut x = 5U8; let mut y = 10U8; x = 15U8; y = 20U8; x + y",
      ),
    ).toBe(35);
  });

  // Type specifications with assignment
  test("assignment > explicit type on mutable: let mut x : U8 = 0U8; x = 50U8; x => 50", () => {
    expect(interpretTuff("let mut x : U8 = 0U8; x = 50U8; x")).toBe(50);
  });

  test("assignment > explicit type U16: let mut x : U16 = 100U8; x = 200U16; x => 200", () => {
    expect(interpretTuff("let mut x : U16 = 100U8; x = 200U16; x")).toBe(200);
  });

  // Assignment with arithmetic RHS
  test("assignment > assign arithmetic expression: let mut x = 0U8; x = 2U8 + 3U8; x => 5", () => {
    expect(interpretTuff("let mut x = 0U8; x = 2U8 + 3U8; x")).toBe(5);
  });

  test("assignment > assign with precedence: let mut x = 0U8; x = 2U8 + 3U8 * 4U8; x => 14", () => {
    expect(interpretTuff("let mut x = 0U8; x = 2U8 + 3U8 * 4U8; x")).toBe(14);
  });

  test("assignment > assign with previous variable: let mut x = 10U8; x = x + 5U8; x => 15", () => {
    expect(interpretTuff("let mut x = 10U8; x = x + 5U8; x")).toBe(15);
  });

  // Shadowing with mut
  test("assignment > shadow immutable with mut: let x = 5U8; let mut x = 10U8; x = 15U8; x => 15", () => {
    expect(interpretTuff("let x = 5U8; let mut x = 10U8; x = 15U8; x")).toBe(
      15,
    );
  });

  test("assignment > shadow mutable with mutable: let mut x = 5U8; let mut x = 10U8; x = 15U8; x => 15", () => {
    expect(
      interpretTuff("let mut x = 5U8; let mut x = 10U8; x = 15U8; x"),
    ).toBe(15);
  });

  test("assignment > shadow with immutable new binding: let mut x = 5U8; let x = 10U8; x => 10", () => {
    expect(interpretTuff("let mut x = 5U8; let x = 10U8; x")).toBe(10);
  });

  // Complex scoping with assignment
  test("assignment > multiple mutable in scope: let mut a = 1U8; let mut b = 2U8; let mut c = 3U8; a = 10U8; b = 20U8; c = 30U8; a + b + c => 60", () => {
    expect(
      interpretTuff(
        "let mut a = 1U8; let mut b = 2U8; let mut c = 3U8; a = 10U8; b = 20U8; c = 30U8; a + b + c",
      ),
    ).toBe(60);
  });

  // Whitespace variations
  test("assignment > extra whitespace in assignment: let mut x = 0U8  ;  x = 5U8  ;  x => 5", () => {
    expect(interpretTuff("let mut x = 0U8  ;  x = 5U8  ;  x")).toBe(5);
  });

  test("assignment > minimal whitespace: let mut x=0U8;x=5U8;x => 5", () => {
    expect(interpretTuff("let mut x=0U8;x=5U8;x")).toBe(5);
  });

  // Error cases: assignment to immutable
  test("assignment > error: cannot assign to immutable: let x = 5U8; x = 10U8; => Err", () => {
    expect(() => interpretTuff("let x = 5U8; x = 10U8;")).toThrow();
  });

  test("assignment > error: shadowed immutable not mutable: let x = 5U8; let x = 10U8; x = 15U8; => Err", () => {
    expect(() =>
      interpretTuff("let x = 5U8; let x = 10U8; x = 15U8;"),
    ).toThrow();
  });

  // Error cases: undefined variables
  test("assignment > error: assign to undefined: x = 5U8; => Err", () => {
    expect(() => interpretTuff("x = 5U8;")).toThrow();
  });

  test("assignment > error: assign to undefined in sequence: let mut x = 0U8; y = 5U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 0U8; y = 5U8;")).toThrow();
  });

  // Error cases: type violations
  test("assignment > error: assign value out of range for type: let mut x = 0U8; x = 300U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 0U8; x = 300U8;")).toThrow();
  });

  test("assignment > error: assign wrong type U16 to U8 initial: let mut x : U8 = 0U8; x = 300U16; => Err", () => {
    expect(() => interpretTuff("let mut x : U8 = 0U8; x = 300U16;")).toThrow();
  });

  test("assignment > error: assign overflow U8: let mut x = 0U8; x = 200U8 + 100U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; x = 200U8 + 100U8;"),
    ).toThrow();
  });

  // Reference undefined variable in assignment RHS
  test("assignment > error: undefined variable in RHS: let mut x = 0U8; x = y + 5U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 0U8; x = y + 5U8;")).toThrow();
  });

  // Edge cases
  test("assignment > zero value: let mut x = 0U8; x = 0U8; x => 0", () => {
    expect(interpretTuff("let mut x = 0U8; x = 0U8; x")).toBe(0);
  });

  test("assignment > max value U8: let mut x = 0U8; x = 255U8; x => 255", () => {
    expect(interpretTuff("let mut x = 0U8; x = 255U8; x")).toBe(255);
  });

  test("assignment > max value U16: let mut x = 0U16; x = 65535U16; x => 65535", () => {
    expect(interpretTuff("let mut x = 0U16; x = 65535U16; x")).toBe(65535);
  });

  test("assignment > increment pattern: let mut x = 0U8; x = x + 1U8; x = x + 1U8; x => 2", () => {
    expect(interpretTuff("let mut x = 0U8; x = x + 1U8; x = x + 1U8; x")).toBe(
      2,
    );
  });

  test("assignment > accumulation: let mut sum = 0U8; sum = sum + 10U8; sum = sum + 20U8; sum => 30", () => {
    expect(
      interpretTuff(
        "let mut sum = 0U8; sum = sum + 10U8; sum = sum + 20U8; sum",
      ),
    ).toBe(30);
  });
});
