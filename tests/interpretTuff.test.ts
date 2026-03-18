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

  // Compound assignment
  test("assignment > compound += increments mutable binding: let mut x = 1U8; x += 2U8; x => 3", () => {
    expect(interpretTuff("let mut x = 1U8; x += 2U8; x")).toBe(3);
  });

  test("assignment > compound += uses arithmetic RHS precedence: let mut x = 1U8; x += 2U8 * 3U8; x => 7", () => {
    expect(interpretTuff("let mut x = 1U8; x += 2U8 * 3U8; x")).toBe(7);
  });

  test("assignment > compound += behaves like x = x + rhs with widening: let mut x : U16 = 100U8; x += 200U16; x => 300", () => {
    expect(interpretTuff("let mut x : U16 = 100U8; x += 200U16; x")).toBe(300);
  });

  test("assignment > compound += works in if statement branch: let mut x = 0U8; if (true) x += 5U8; x => 5", () => {
    expect(interpretTuff("let mut x = 0U8; if (true) x += 5U8; x")).toBe(5);
  });

  test("assignment > error: compound += rejects immutable variable: let x = 1U8; x += 2U8; => Err", () => {
    expect(() => interpretTuff("let x = 1U8; x += 2U8;")).toThrow();
  });

  test("assignment > error: compound += rejects undefined variable: x += 1U8; => Err", () => {
    expect(() => interpretTuff("x += 1U8;")).toThrow();
  });

  test("assignment > error: compound += rejects Bool target: let mut flag : Bool = false; flag += true; => Err", () => {
    expect(() =>
      interpretTuff("let mut flag : Bool = false; flag += true;"),
    ).toThrow();
  });

  test("assignment > error: compound += rejects Bool RHS for numeric target: let mut x = 1U8; x += true; => Err", () => {
    expect(() => interpretTuff("let mut x = 1U8; x += true;")).toThrow();
  });

  test("assignment > error: compound += rejects overflow like addition: let mut x = 250U8; x += 10U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 250U8; x += 10U8;")).toThrow();
  });

  test("assignment > error: compound += is statement-only and cannot be used as initializer value", () => {
    expect(() =>
      interpretTuff("let mut x = 1U8; let y = x += 2U8; y"),
    ).toThrow();
  });

  // Compound -= tests
  test("assignment > compound -= decrements mutable binding: let mut x = 10U8; x -= 3U8; x => 7", () => {
    expect(interpretTuff("let mut x = 10U8; x -= 3U8; x")).toBe(7);
  });

  test("assignment > compound -= uses arithmetic RHS precedence: let mut x = 10U8; x -= 2U8 + 1U8; x => 7", () => {
    expect(interpretTuff("let mut x = 10U8; x -= 2U8 + 1U8; x")).toBe(7);
  });

  test("assignment > error: compound -= rejects immutable variable: let x = 10U8; x -= 3U8; => Err", () => {
    expect(() => interpretTuff("let x = 10U8; x -= 3U8;")).toThrow();
  });

  test("assignment > error: compound -= rejects underflow: let mut x = 5U8; x -= 10U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 5U8; x -= 10U8;")).toThrow();
  });

  test("assignment > error: compound -= rejects Bool target: let mut flag : Bool = true; flag -= false; => Err", () => {
    expect(() =>
      interpretTuff("let mut flag : Bool = true; flag -= false;"),
    ).toThrow();
  });

  // Compound *= tests
  test("assignment > compound *= multiplies mutable binding: let mut x = 5U8; x *= 3U8; x => 15", () => {
    expect(interpretTuff("let mut x = 5U8; x *= 3U8; x")).toBe(15);
  });

  test("assignment > compound *= uses arithmetic RHS precedence: let mut x = 2U8; x *= 3U8 + 2U8; x => 10", () => {
    expect(interpretTuff("let mut x = 2U8; x *= 3U8 + 2U8; x")).toBe(10);
  });

  test("assignment > error: compound *= rejects undefined variable: x *= 2U8; => Err", () => {
    expect(() => interpretTuff("x *= 2U8;")).toThrow();
  });

  test("assignment > error: compound *= rejects overflow: let mut x = 200U8; x *= 2U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 200U8; x *= 2U8;")).toThrow();
  });

  test("assignment > error: compound *= rejects Bool operand: let mut flag : Bool = true; flag *= false; => Err", () => {
    expect(() =>
      interpretTuff("let mut flag : Bool = true; flag *= false;"),
    ).toThrow();
  });

  // Compound /= tests
  test("assignment > compound /= divides mutable binding: let mut x = 20U8; x /= 4U8; x => 5", () => {
    expect(interpretTuff("let mut x = 20U8; x /= 4U8; x")).toBe(5);
  });

  test("assignment > compound /= integer division: let mut x = 7U8; x /= 2U8; x => 3", () => {
    expect(interpretTuff("let mut x = 7U8; x /= 2U8; x")).toBe(3);
  });

  test("assignment > error: compound /= rejects division by zero: let mut x = 10U8; x /= 0U8; => Err", () => {
    expect(() => interpretTuff("let mut x = 10U8; x /= 0U8;")).toThrow();
  });

  test("assignment > error: compound /= rejects immutable variable: let x = 20U8; x /= 2U8; => Err", () => {
    expect(() => interpretTuff("let x = 20U8; x /= 2U8;")).toThrow();
  });

  test("assignment > error: compound /= rejects Bool operand: let mut flag : Bool = false; flag /= true; => Err", () => {
    expect(() =>
      interpretTuff("let mut flag : Bool = false; flag /= true;"),
    ).toThrow();
  });
});

describe("interpretTuff booleans", () => {
  // Basic literals
  test("bool > true literal => 1", () => {
    expect(interpretTuff("true")).toBe(1);
  });

  test("bool > false literal => 0", () => {
    expect(interpretTuff("false")).toBe(0);
  });

  // Let bindings and inference
  test("bool > let inference from true: let x = true; x => 1", () => {
    expect(interpretTuff("let x = true; x")).toBe(1);
  });

  test("bool > let inference from false: let x = false; x => 0", () => {
    expect(interpretTuff("let x = false; x")).toBe(0);
  });

  test("bool > explicit Bool annotation with true: let x : Bool = true; x => 1", () => {
    expect(interpretTuff("let x : Bool = true; x")).toBe(1);
  });

  test("bool > explicit Bool annotation with false: let x : Bool = false; x => 0", () => {
    expect(interpretTuff("let x : Bool = false; x")).toBe(0);
  });

  // Mutable bools and assignment
  test("bool > mutable Bool assignment: let mut flag : Bool = false; flag = true; flag => 1", () => {
    expect(
      interpretTuff("let mut flag : Bool = false; flag = true; flag"),
    ).toBe(1);
  });

  test("bool > inferred mutable Bool assignment: let mut flag = true; flag = false; flag => 0", () => {
    expect(interpretTuff("let mut flag = true; flag = false; flag")).toBe(0);
  });

  // Unary not
  test("bool > unary not on true: !true => 0", () => {
    expect(interpretTuff("!true")).toBe(0);
  });

  test("bool > unary not on false: !false => 1", () => {
    expect(interpretTuff("!false")).toBe(1);
  });

  test("bool > unary not with parens: !(true && false) => 1", () => {
    expect(interpretTuff("!(true && false)")).toBe(1);
  });

  // Logical operators
  test("bool > and true && true => 1", () => {
    expect(interpretTuff("true && true")).toBe(1);
  });

  test("bool > and true && false => 0", () => {
    expect(interpretTuff("true && false")).toBe(0);
  });

  test("bool > or false || true => 1", () => {
    expect(interpretTuff("false || true")).toBe(1);
  });

  test("bool > or false || false => 0", () => {
    expect(interpretTuff("false || false")).toBe(0);
  });

  test("bool > precedence not before and before or: !false && false || true => 1", () => {
    expect(interpretTuff("!false && false || true")).toBe(1);
  });

  test("bool > parentheses with logical ops: !(false || false) && true => 1", () => {
    expect(interpretTuff("!(false || false) && true")).toBe(1);
  });

  test("bool > logical ops in let binding: let x = true && false; x => 0", () => {
    expect(interpretTuff("let x = true && false; x")).toBe(0);
  });

  test("bool > logical ops in assignment: let mut x : Bool = false; x = true || false; x => 1", () => {
    expect(
      interpretTuff("let mut x : Bool = false; x = true || false; x"),
    ).toBe(1);
  });

  // Short-circuit behavior
  test("bool > short-circuit and skips undefined RHS: false && missing => 0", () => {
    expect(interpretTuff("false && missing")).toBe(0);
  });

  test("bool > short-circuit or skips undefined RHS: true || missing => 1", () => {
    expect(interpretTuff("true || missing")).toBe(1);
  });

  // Error cases: arithmetic on booleans
  test("bool > error: true + false => Err", () => {
    expect(() => interpretTuff("true + false")).toThrow();
  });

  test("bool > error: true * false => Err", () => {
    expect(() => interpretTuff("true * false")).toThrow();
  });

  test("bool > error: !1U8 => Err", () => {
    expect(() => interpretTuff("!1U8")).toThrow();
  });

  // Error cases: mixed bool and numeric expressions
  test("bool > error: true + 1U8 => Err", () => {
    expect(() => interpretTuff("true + 1U8")).toThrow();
  });

  test("bool > error: 1U8 && true => Err", () => {
    expect(() => interpretTuff("1U8 && true")).toThrow();
  });

  test("bool > error: false || 0U8 => Err", () => {
    expect(() => interpretTuff("false || 0U8")).toThrow();
  });

  // Error cases: invalid type assignments
  test("bool > error: assign number to Bool variable: let mut flag : Bool = false; flag = 1U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut flag : Bool = false; flag = 1U8;"),
    ).toThrow();
  });

  test("bool > error: assign Bool to numeric variable: let mut x : U8 = 0U8; x = true; => Err", () => {
    expect(() => interpretTuff("let mut x : U8 = 0U8; x = true;")).toThrow();
  });

  test("bool > error: let Bool into numeric annotation: let x : U8 = true; => Err", () => {
    expect(() => interpretTuff("let x : U8 = true;")).toThrow();
  });

  test("bool > error: let number into Bool annotation: let x : Bool = 1U8; => Err", () => {
    expect(() => interpretTuff("let x : Bool = 1U8;")).toThrow();
  });

  // Error cases: unsupported spellings
  test("bool > error: uppercase True is undefined", () => {
    expect(() => interpretTuff("True")).toThrow();
  });

  test("bool > error: uppercase False is undefined", () => {
    expect(() => interpretTuff("False")).toThrow();
  });
});

describe("interpretTuff comparisons", () => {
  // Numeric equality
  test("comparison > numeric equality true: 5U8 == 5U8 => 1", () => {
    expect(interpretTuff("5U8 == 5U8")).toBe(1);
  });

  test("comparison > numeric equality false: 5U8 == 6U8 => 0", () => {
    expect(interpretTuff("5U8 == 6U8")).toBe(0);
  });

  test("comparison > numeric inequality true: 5U8 != 6U8 => 1", () => {
    expect(interpretTuff("5U8 != 6U8")).toBe(1);
  });

  test("comparison > numeric inequality false: 5U8 != 5U8 => 0", () => {
    expect(interpretTuff("5U8 != 5U8")).toBe(0);
  });

  // Numeric ordering
  test("comparison > less-than true: 5U8 < 6U8 => 1", () => {
    expect(interpretTuff("5U8 < 6U8")).toBe(1);
  });

  test("comparison > less-than false: 6U8 < 5U8 => 0", () => {
    expect(interpretTuff("6U8 < 5U8")).toBe(0);
  });

  test("comparison > less-than-or-equal equal: 5U8 <= 5U8 => 1", () => {
    expect(interpretTuff("5U8 <= 5U8")).toBe(1);
  });

  test("comparison > greater-than true: 6U8 > 5U8 => 1", () => {
    expect(interpretTuff("6U8 > 5U8")).toBe(1);
  });

  test("comparison > greater-than-or-equal equal: 5U8 >= 5U8 => 1", () => {
    expect(interpretTuff("5U8 >= 5U8")).toBe(1);
  });

  // Mixed numeric types
  test("comparison > mixed numeric types equality: 5U8 == 5U16 => 1", () => {
    expect(interpretTuff("5U8 == 5U16")).toBe(1);
  });

  test("comparison > mixed numeric types ordering: 5U8 < 1000U16 => 1", () => {
    expect(interpretTuff("5U8 < 1000U16")).toBe(1);
  });

  // Bool equality only
  test("comparison > bool equality true: true == true => 1", () => {
    expect(interpretTuff("true == true")).toBe(1);
  });

  test("comparison > bool equality false: true == false => 0", () => {
    expect(interpretTuff("true == false")).toBe(0);
  });

  test("comparison > bool inequality true: true != false => 1", () => {
    expect(interpretTuff("true != false")).toBe(1);
  });

  test("comparison > bool inequality false: false != false => 0", () => {
    expect(interpretTuff("false != false")).toBe(0);
  });

  // Precedence
  test("comparison > arithmetic before comparison: 2U8 + 3U8 == 5U8 => 1", () => {
    expect(interpretTuff("2U8 + 3U8 == 5U8")).toBe(1);
  });

  test("comparison > comparison before logical and: 2U8 < 3U8 && true => 1", () => {
    expect(interpretTuff("2U8 < 3U8 && true")).toBe(1);
  });

  test("comparison > comparison before logical or: false || 2U8 < 3U8 => 1", () => {
    expect(interpretTuff("false || 2U8 < 3U8")).toBe(1);
  });

  test("comparison > parentheses with comparison: !(2U8 > 3U8) => 1", () => {
    expect(interpretTuff("!(2U8 > 3U8)")).toBe(1);
  });

  // Let and assignment integration
  test("comparison > let binding from comparison: let x = 5U8 < 6U8; x => 1", () => {
    expect(interpretTuff("let x = 5U8 < 6U8; x")).toBe(1);
  });

  test("comparison > explicit Bool from comparison: let x : Bool = 5U8 == 5U8; x => 1", () => {
    expect(interpretTuff("let x : Bool = 5U8 == 5U8; x")).toBe(1);
  });

  test("comparison > mutable assignment from comparison: let mut x : Bool = false; x = 5U8 < 6U8; x => 1", () => {
    expect(interpretTuff("let mut x : Bool = false; x = 5U8 < 6U8; x")).toBe(1);
  });

  // Short-circuit with comparisons
  test("comparison > short-circuit and skips invalid comparison RHS: false && 1U8 < true => 0", () => {
    expect(interpretTuff("false && 1U8 < true")).toBe(0);
  });

  test("comparison > short-circuit or skips invalid comparison RHS: true || 1U8 < true => 1", () => {
    expect(interpretTuff("true || 1U8 < true")).toBe(1);
  });

  // Error cases: bool ordering unsupported
  test("comparison > error: true < false => Err", () => {
    expect(() => interpretTuff("true < false")).toThrow();
  });

  test("comparison > error: true >= false => Err", () => {
    expect(() => interpretTuff("true >= false")).toThrow();
  });

  // Error cases: mixed bool/numeric comparisons
  test("comparison > error: true == 1U8 => Err", () => {
    expect(() => interpretTuff("true == 1U8")).toThrow();
  });

  test("comparison > error: 1U8 != false => Err", () => {
    expect(() => interpretTuff("1U8 != false")).toThrow();
  });

  test("comparison > error: 1U8 < true => Err", () => {
    expect(() => interpretTuff("1U8 < true")).toThrow();
  });

  test("comparison > error: false > 0U8 => Err", () => {
    expect(() => interpretTuff("false > 0U8")).toThrow();
  });
});

describe("interpretTuff braced blocks", () => {
  // Basic block values
  test("block > top-level block with final expression: { let x = 1U8; x } => 1", () => {
    expect(interpretTuff("{ let x = 1U8; x }")).toBe(1);
  });

  test("block > block as let initializer: let x = { let y = 10U8; y }; x => 10", () => {
    expect(interpretTuff("let x = { let y = 10U8; y }; x")).toBe(10);
  });

  test("block > block as assignment value: let mut x = 0U8; x = { 5U8 }; x => 5", () => {
    expect(interpretTuff("let mut x = 0U8; x = { 5U8 }; x")).toBe(5);
  });

  test("block > block in arithmetic expression: 1U8 + { 2U8 } => 3", () => {
    expect(interpretTuff("1U8 + { 2U8 }")).toBe(3);
  });

  test("block > nested blocks: { let x = { let y = 2U8; y + 3U8 }; x } => 5", () => {
    expect(interpretTuff("{ let x = { let y = 2U8; y + 3U8 }; x }")).toBe(5);
  });

  // Scope behavior
  test("block > outer variable visible inside block: let x = 5U8; { x + 1U8 } => 6", () => {
    expect(interpretTuff("let x = 5U8; { x + 1U8 }")).toBe(6);
  });

  test("block > inner declarations do not escape: let x = { let y = 1U8; y }; y => Err", () => {
    expect(() => interpretTuff("let x = { let y = 1U8; y }; y")).toThrow();
  });

  test("block > shadowing inside block does not escape: let x = 1U8; { let x = 2U8; x }; x => 1", () => {
    expect(interpretTuff("let x = 1U8; { let x = 2U8; x }; x")).toBe(1);
  });

  // Mutation behavior
  test("block > mutation of outer mutable persists: let mut x = 0U8; { x = 100U8; } x => 100", () => {
    expect(interpretTuff("let mut x = 0U8; { x = 100U8; } x")).toBe(100);
  });

  test("block > inner shadowed mutable assignment does not affect outer binding: let mut x = 1U8; { let mut x = 2U8; x = 3U8; } x => 1", () => {
    expect(
      interpretTuff("let mut x = 1U8; { let mut x = 2U8; x = 3U8; } x"),
    ).toBe(1);
  });

  // Bool and comparisons inside blocks
  test("block > bool result block: { true && false } => 0", () => {
    expect(interpretTuff("{ true && false }")).toBe(0);
  });

  test("block > comparison inside block: { 2U8 < 3U8 } => 1", () => {
    expect(interpretTuff("{ 2U8 < 3U8 }")).toBe(1);
  });

  test("block > block used in comparison: { 2U8 + 3U8 } == 5U8 => 1", () => {
    expect(interpretTuff("{ 2U8 + 3U8 } == 5U8")).toBe(1);
  });

  // Empty block rule
  test("block > empty standalone block is valid: let x = 0U8; {} x => 0", () => {
    expect(interpretTuff("let x = 0U8; {} x")).toBe(0);
  });

  test("block > empty block as value is invalid: let x = {}; x => Err", () => {
    expect(() => interpretTuff("let x = {}; x")).toThrow();
  });

  test("block > empty nested value block is invalid: 1U8 + {} => Err", () => {
    expect(() => interpretTuff("1U8 + {} ")).toThrow();
  });

  // Syntax and error cases
  test("block > missing closing brace: { let x = 1U8; x => Err", () => {
    expect(() => interpretTuff("{ let x = 1U8; x")).toThrow();
  });

  test("block > immutable assignment inside block still errors: let x = 1U8; { x = 2U8; } => Err", () => {
    expect(() => interpretTuff("let x = 1U8; { x = 2U8; }")).toThrow();
  });

  test("block > undefined variable outside block after standalone block: { let y = 1U8; y } y => Err", () => {
    expect(() => interpretTuff("{ let y = 1U8; y } y")).toThrow();
  });
});

describe("interpretTuff if", () => {
  // Expression form
  test("if > expression chooses then branch: if (true) 1U8 else 2U8 => 1", () => {
    expect(interpretTuff("if (true) 1U8 else 2U8")).toBe(1);
  });

  test("if > expression chooses else branch: if (false) 1U8 else 2U8 => 2", () => {
    expect(interpretTuff("if (false) 1U8 else 2U8")).toBe(2);
  });

  test("if > expression branch can be block: if (true) { let x = 5U8; x } else { 2U8 } => 5", () => {
    expect(interpretTuff("if (true) { let x = 5U8; x } else { 2U8 }")).toBe(5);
  });

  test("if > expression in let initializer: let x = if (true) 3U8 else 4U8; x => 3", () => {
    expect(interpretTuff("let x = if (true) 3U8 else 4U8; x")).toBe(3);
  });

  test("if > expression in assignment RHS: let mut x = 0U8; x = if (false) 3U8 else 4U8; x => 4", () => {
    expect(
      interpretTuff("let mut x = 0U8; x = if (false) 3U8 else 4U8; x"),
    ).toBe(4);
  });

  test("if > expression nested in arithmetic: 1U8 + if (true) 2U8 else 3U8 => 3", () => {
    expect(interpretTuff("1U8 + if (true) 2U8 else 3U8")).toBe(3);
  });

  test("if > expression else-if chain: if (false) 1U8 else if (true) 2U8 else 3U8 => 2", () => {
    expect(interpretTuff("if (false) 1U8 else if (true) 2U8 else 3U8")).toBe(2);
  });

  // Statement form
  test("if > statement with else updates mutable binding: let mut x = 0U8; if (true) x = 1U8; else x = 2U8; x => 1", () => {
    expect(
      interpretTuff("let mut x = 0U8; if (true) x = 1U8; else x = 2U8; x"),
    ).toBe(1);
  });

  test("if > statement without else may skip branch: let mut x = 0U8; if (false) x = 1U8; x => 0", () => {
    expect(interpretTuff("let mut x = 0U8; if (false) x = 1U8; x")).toBe(0);
  });

  test("if > statement branch can be block with local scope: let mut x = 0U8; if (true) { let y = 1U8; x = y; } x => 1", () => {
    expect(
      interpretTuff("let mut x = 0U8; if (true) { let y = 1U8; x = y; } x"),
    ).toBe(1);
  });

  test("if > statement else-if chain picks later branch: let mut x = 0U8; if (false) x = 1U8; else if (true) x = 2U8; else x = 3U8; x => 2", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; if (false) x = 1U8; else if (true) x = 2U8; else x = 3U8; x",
      ),
    ).toBe(2);
  });

  // Scope and type behavior
  test("if > branch-local declaration does not escape: if (true) { let y = 1U8; y } else { 2U8 }; y => Err", () => {
    expect(() =>
      interpretTuff("if (true) { let y = 1U8; y } else { 2U8 }; y"),
    ).toThrow();
  });

  test("if > error: condition must be Bool in expression form", () => {
    expect(() => interpretTuff("if (1U8) 2U8 else 3U8")).toThrow();
  });

  test("if > error: condition must be Bool in statement form", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; if (1U8) x = 1U8; x"),
    ).toThrow();
  });

  test("if > error: missing parentheses around condition", () => {
    expect(() => interpretTuff("if true 1U8 else 2U8")).toThrow();
  });

  test("if > error: expression form requires else", () => {
    expect(() => interpretTuff("let x = if (true) 1U8; x")).toThrow();
  });

  test("if > error: expression branch types must match", () => {
    expect(() => interpretTuff("if (true) 1U8 else false")).toThrow();
  });

  test("if > error: else-if expression chain still requires final else", () => {
    expect(() =>
      interpretTuff("let x = if (false) 1U8 else if (true) 2U8; x"),
    ).toThrow();
  });

  test("if > error: missing closing brace in statement branch", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; if (true) { x = 1U8; else x = 2U8; x"),
    ).toThrow();
  });

  test("if > error: branch-local declaration in statement does not escape", () => {
    expect(() => interpretTuff("if (true) { let y = 1U8; } y")).toThrow();
  });
});

describe("interpretTuff while", () => {
  // Basic while loop tests
  test("while > simple counter loop: let mut x = 0U8; while (x < 3U8) x = x + 1U8; x => 3", () => {
    expect(
      interpretTuff("let mut x = 0U8; while (x < 3U8) x = x + 1U8; x"),
    ).toBe(3);
  });

  test("while > while with brace block: let mut x = 0U8; while (x < 2U8) { x = x + 1U8; } x => 2", () => {
    expect(
      interpretTuff("let mut x = 0U8; while (x < 2U8) { x = x + 1U8; } x"),
    ).toBe(2);
  });

  test("while > while condition false skips loop: let mut x = 0U8; while (false) x = 1U8; x => 0", () => {
    expect(interpretTuff("let mut x = 0U8; while (false) x = 1U8; x")).toBe(0);
  });

  test("while > while with break exits loop: let mut x = 0U8; while (true) { x = x + 1U8; if (x == 3U8) break; } x => 3", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; while (true) { x = x + 1U8; if (x == 3U8) break; } x",
      ),
    ).toBe(3);
  });

  test("while > while with continue skips to next iteration: let mut x = 0U8; let mut s = 0U8; while (x < 5U8) { x = x + 1U8; if (x == 2U8) continue; s = s + x; } s => 13", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; let mut s = 0U8; while (x < 5U8) { x = x + 1U8; if (x == 2U8) continue; s = s + x; } s",
      ),
    ).toBe(13);
  });

  test("while > while counting to larger value: let mut x = 0U8; while (x < 10U8) x = x + 1U8; x => 10", () => {
    expect(
      interpretTuff("let mut x = 0U8; while (x < 10U8) x = x + 1U8; x"),
    ).toBe(10);
  });

  test("while > nested while loops: let mut x = 0U8; let mut y = 0U8; while (x < 2U8) { x = x + 1U8; y = 0U8; while (y < 3U8) y = y + 1U8; } y => 3", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; let mut y = 0U8; while (x < 2U8) { x = x + 1U8; y = 0U8; while (y < 3U8) y = y + 1U8; } y",
      ),
    ).toBe(3);
  });

  test("while > while with compound assignment: let mut x = 0U8; let mut s = 0U8; while (x < 5U8) { x += 1U8; s += x; } s => 15", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; let mut s = 0U8; while (x < 5U8) { x += 1U8; s += x; } s",
      ),
    ).toBe(15);
  });

  // Scope semantics
  test("while > loop scope: fresh scope per iteration, local x does not persist: let mut x = 0U8; while (x < 2U8) { let y = 1U8; x = x + 1U8; } y => Err", () => {
    expect(() =>
      interpretTuff(
        "let mut x = 0U8; while (x < 2U8) { let y = 1U8; x = x + 1U8; } y",
      ),
    ).toThrow();
  });

  test("while > outer mutable persists across iterations: let mut x = 0U8; let mut total = 0U8; while (x < 3U8) { x = x + 1U8; total = total + x; } total => 6", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; let mut total = 0U8; while (x < 3U8) { x = x + 1U8; total = total + x; } total",
      ),
    ).toBe(6);
  });

  // Control flow edge cases
  test("while > nested break affects inner loop only: let mut x = 0U8; let mut y = 0U8; while (x < 3U8) { x = x + 1U8; y = 0U8; while (y < 10U8) { y = y + 1U8; if (y == 2U8) break; } } y => 2", () => {
    expect(
      interpretTuff(
        "let mut x = 0U8; let mut y = 0U8; while (x < 3U8) { x = x + 1U8; y = 0U8; while (y < 10U8) { y = y + 1U8; if (y == 2U8) break; } } y",
      ),
    ).toBe(2);
  });

  test("while > multiple iterations count correctly: let mut x = 0U8; while (x < 100U8) x = x + 10U8; x => 100", () => {
    expect(
      interpretTuff("let mut x = 0U8; while (x < 100U8) x = x + 10U8; x"),
    ).toBe(100);
  });

  // Error cases
  test("while > error: condition must be Bool: let mut x = 0U8; while (5U8) x = x + 1U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; while (5U8) x = x + 1U8;"),
    ).toThrow();
  });

  test("while > error: Bool required, true works but numbers fail: let mut x = 0U8; while (1U8) x = x + 1U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; while (1U8) x = x + 1U8;"),
    ).toThrow();
  });

  test("while > error: undefined variable in condition: let mut x = 0U8; while (y < 3U8) x = x + 1U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; while (y < 3U8) x = x + 1U8;"),
    ).toThrow();
  });

  test("while > error: undefined variable in body: let mut x = 0U8; while (x < 2U8) { z = 1U8; } => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; while (x < 2U8) { z = 1U8; }"),
    ).toThrow();
  });

  test("while > error: break outside loop: break; => Err", () => {
    expect(() => interpretTuff("break;")).toThrow();
  });

  test("while > error: continue outside loop: continue; => Err", () => {
    expect(() => interpretTuff("continue;")).toThrow();
  });

  test("while > error: while as expression (not statement): let x = while (true) 1U8; => Err", () => {
    expect(() => interpretTuff("let x = while (true) 1U8;")).toThrow();
  });

  test("while > error: missing closing parenthesis: let mut x = 0U8; while (x < 3U8 x = x + 1U8; => Err", () => {
    expect(() =>
      interpretTuff("let mut x = 0U8; while (x < 3U8 x = x + 1U8;"),
    ).toThrow();
  });
});

describe("interpretTuff functions", () => {
  test("fn > simple definition with expression RHS and call: fn add(first : U8, second : U8) : U8 => first + second; add(2U8, 3U8) => 5", () => {
    expect(
      interpretTuff(
        "fn add(first : U8, second : U8) : U8 => first + second; add(2U8, 3U8)",
      ),
    ).toBe(5);
  });

  test("fn > block expression RHS can use return statement for early exit", () => {
    expect(
      interpretTuff(
        "fn classify(x : U8) : U8 => { if (x == 0U8) return 10U8; x + 1U8 }; classify(0U8)",
      ),
    ).toBe(10);
  });

  test("fn > block expression RHS without early return uses final expression", () => {
    expect(
      interpretTuff(
        "fn classify(x : U8) : U8 => { if (x == 0U8) return 10U8; x + 1U8 }; classify(4U8)",
      ),
    ).toBe(5);
  });

  test("fn > recursion works: factorial(5) => 120", () => {
    expect(
      interpretTuff(
        "fn fact(n : U8) : U8 => { if (n == 0U8) return 1U8; n * fact(n - 1U8) }; fact(5U8)",
      ),
    ).toBe(120);
  });

  test("fn > closure can mutate outer mutable binding", () => {
    expect(
      interpretTuff(
        "let mut x = 1U8; fn bump() : U8 => { x = x + 1U8; x }; bump(); bump(); x",
      ),
    ).toBe(3);
  });

  test("fn > overloading by arity selects correct function", () => {
    expect(
      interpretTuff(
        "fn add(x : U8) : U8 => x + 1U8; fn add(x : U8, y : U8) : U8 => x + y; add(2U8, 3U8)",
      ),
    ).toBe(5);
  });

  test("fn > overloading by arity selects unary overload", () => {
    expect(
      interpretTuff(
        "fn add(x : U8) : U8 => x + 1U8; fn add(x : U8, y : U8) : U8 => x + y; add(2U8)",
      ),
    ).toBe(3);
  });

  test("fn > supports forward references", () => {
    expect(
      interpretTuff(
        "useLater(9U8); fn useLater(v : U8) : U8 => v + 1U8; useLater(9U8)",
      ),
    ).toBe(10);
  });

  test("fn > error: return outside function", () => {
    expect(() => interpretTuff("return 1U8;")).toThrow();
  });

  test("fn > error: undefined function call", () => {
    expect(() => interpretTuff("missing(1U8)")).toThrow();
  });

  test("fn > error: arity mismatch", () => {
    expect(() =>
      interpretTuff("fn add(x : U8, y : U8) : U8 => x + y; add(1U8)"),
    ).toThrow();
  });

  test("fn > error: duplicate identical signature is rejected", () => {
    expect(() =>
      interpretTuff(
        "fn add(x : U8) : U8 => x; fn add(x : U8) : U8 => x + 1U8;",
      ),
    ).toThrow();
  });

  test("fn > error: parameter type mismatch", () => {
    expect(() =>
      interpretTuff("fn add(x : U8, y : U8) : U8 => x + y; add(true, 1U8)"),
    ).toThrow();
  });

  test("fn > error: explicit return type mismatch", () => {
    expect(() =>
      interpretTuff("fn bad(x : U8) : Bool => x + 1U8; bad(1U8)"),
    ).toThrow();
  });

  test("fn > error: function with value return type must return value", () => {
    expect(() =>
      interpretTuff("fn bad(x : U8) : U8 => {}; bad(1U8)"),
    ).toThrow();
  });
});
