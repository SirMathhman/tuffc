/* eslint-disable max-lines */
import { compile } from "../src";

function assertValid(
  source: string,
  stdInOrExpected: string | number,
  expected?: number,
): void {
  const result = compile(source);
  if (result.type === "ok") {
    if (typeof stdInOrExpected === "number") {
      expect(new Function(`return ${result.value}`)()).toBe(stdInOrExpected);
    } else {
      const values: number[] = [];
      let current = "",
        i = 0;
      while (i < stdInOrExpected.length) {
        const char = stdInOrExpected[i];
        if (char !== " " && char !== "\t" && char !== "\n") {
          current += char;
        } else if (current) {
          values.push(Number(current));
          current = "";
        }
        i++;
      }
      if (current) values.push(Number(current));
      let index = 0;
      const read = (): number => values[index++];
      expect(new Function("read", `return ${result.value}`)(read)).toBe(
        expected,
      );
    }
  } else {
    expect(result.error).toBeUndefined();
  }
}

function assertInvalid(source: string): void {
  const result = compile(source);
  expect(result.type).toBe("err");
}

// eslint-disable-next-line max-lines-per-function
describe("The compiler can compile", () => {
  it("an empty program", () => {
    assertValid("", 0);
  });

  it("a number literal", () => {
    assertValid("100", 100);
  });

  it("a number literal with U8 type suffix", () => {
    assertValid("100U8", 100);
  });

  it("rejects negative numbers with type suffix", () => {
    const result = compile("-100U8");
    if (result.type === "ok") {
      expect(result.value).toBeUndefined();
    }
  });

  it("rejects U8 values outside valid range", () => {
    assertInvalid("256U8");
  });

  it("reads a U8 value from input", () => {
    assertValid("read<U8>()", "100", 100);
  });

  it("adds two U8 values from input", () => {
    assertValid("read<U8>() + read<U8>()", "1 2", 3);
  });

  it("declares and uses a variable", () => {
    assertValid("let x : U8 = read<U8>(); x", "1 3", 1);
  });

  it("declares a variable without using it", () => {
    assertValid("let x : U8 = read<U8>();", "1 3", 0);
  });

  it("rejects duplicate variable declarations", () => {
    assertInvalid("let x : U8 = read<U8>(); let x : U8 = read<U8>();");
  });

  it("rejects type mismatch in variable initialization", () => {
    assertInvalid("let x : U8 = read<U16>();");
  });

  it("declares variable without explicit type annotation", () => {
    assertValid("let x = read<U8>(); x", "100", 100);
  });

  it("rejects type mismatch when assigning variable to variable", () => {
    assertInvalid("let x = read<U16>(); let y : U8 = x;");
  });

  it("rejects type mismatch for literal assigned to incompatible declared type (U16)", () => {
    assertInvalid("let x = 0; let y : U16 = x;");
  });

  it("allows literal assigned to wider signed type (I64)", () => {
    assertValid("let x = 0; let y : I64 = x;", 0);
  });

  it("allows literal assigned to matching declared type (I32)", () => {
    assertValid("let x = 0; let y : I32 = x;", 0);
  });

  it("rejects undefined variable reference", () => {
    assertInvalid("x");
  });

  it("reassigns mutable variable", () => {
    assertValid("let mut x = 0; x = read<I32>(); x", "100", 100);
  });

  it("rejects reassignment of immutable variable", () => {
    assertInvalid("let x = 0; x = read<I32>(); x");
  });

  it("rejects reassignment of undefined variable", () => {
    assertInvalid("x = read<I32>(); x");
  });

  it("allows implicit upconversion from U8 to U16", () => {
    assertValid("let x = read<U8>(); let y : U16 = x; y", "100", 100);
  });

  it("rejects reassignment with type mismatch", () => {
    assertInvalid("let mut x = 0; x = read<I64>(); x");
  });

  it("supports pointer types with address-of and dereference", () => {
    assertValid("let x = 100; let y : *I32 = &x; *y", 100);
  });

  it("rejects pointer to undefined variable", () => {
    assertInvalid("let y : *I32 = &x; *y");
  });

  it("rejects dereference of non-pointer variable", () => {
    assertInvalid("let y = 100; *y");
  });

  it("rejects redeclaration of existing variable", () => {
    assertInvalid("let x = 100; let y : *I32 = &x; let x : U8 = *y;");
  });

  it("supports mutable pointer assignment through dereference", () => {
    assertValid("let mut x = 0; let y : *mut I32 = &mut x; *y = 100; x", 100);
  });

  it("rejects assignment through immutable pointer", () => {
    assertInvalid("let mut x = 0; let y : *I32 = &x; *y = 100; x");
  });

  it("supports multiple immutable pointers to the same variable", () => {
    assertValid(
      "let x = 100; let y : *I32 = &x; let z : *I32 = &x; *y + *z",
      200,
    );
  });

  it("supports mutable pointer assignment with reassignment", () => {
    assertValid("let mut x = 0; let y : *mut I32 = &mut x; *y = 100; x", 100);
  });

  it("rejects mixed immutable and mutable pointers to same variable", () => {
    assertInvalid(
      "let mut x = 0; let y : *I32 = &x; let z : *mut I32 = &mut x;",
    );
  });

  it("evaluates empty block expression to 0", () => {
    assertValid("{}", 0);
  });

  it("evaluates block followed by expression to expression value", () => {
    assertValid("{} 100", 100);
  });

  it("evaluates read variable after empty block", () => {
    assertValid("let x = read<U8>(); {} x", "100", 100);
  });

  it("assigns mutable variable inside block and returns it", () => {
    assertValid("let mut x = 0U8; { x = read<U8>(); } x", "100", 100);
  });

  it("rejects use of variable outside its block scope", () => {
    assertInvalid("{ let x = 0; } x");
  });

  it("evaluates let binding with block expression to block result", () => {
    assertValid("let x = { let y = 100; y }; x", 100);
  });

  it("rejects block without final expression in assignment", () => {
    assertInvalid("let x = { let y = 100; }; x");
  });

  it("rejects type mismatch between block return type and variable type", () => {
    assertInvalid("let x : U8 = { let y : U16 = 100; y }; x");
  });

  it("rejects access to variable outside its block scope", () => {
    assertInvalid("let x : U16 = { let y : U8 = 100; y }; y");
  });

  it("evaluates false to 0", () => {
    assertValid("let x : Bool = false; x", 0);
  });

  it("evaluates true to 1", () => {
    assertValid("let x : Bool = true; x", 1);
  });

  it("evaluates logical OR with true || false to 1", () => {
    assertValid("let x = true; let y = false; x || y", 1);
  });

  it("evaluates logical AND with true && false to 0", () => {
    assertValid("let x = true; let y = false; x && y", 0);
  });

  it("rejects non-boolean operands for logical OR", () => {
    assertInvalid("let x = 1; let y = 2; x || y");
  });

  it("rejects non-boolean operands for logical AND", () => {
    assertInvalid("let x = 1; let y = 2; x && y");
  });

  it("rejects arithmetic operators on boolean operands", () => {
    assertInvalid("let x = true; let y = false; x + y");
  });

  it("evaluates if-else with true condition to then branch", () => {
    assertValid("let mut x = 0; if (true) x = 3; else x = 5; x", 3);
  });

  it("evaluates if-else with false condition to else branch", () => {
    assertValid("let mut x = 0; if (false) x = 3; else x = 5; x", 5);
  });

  it("evaluates if-else with variable condition", () => {
    assertValid(
      "let cond = true; let mut x = 0; if (cond) x = 10; else x = 20; x",
      10,
    );
  });

  it("evaluates if-else with braces in then branch", () => {
    assertValid("let mut x = 0; if (true) { x = 3; } else { x = 5; } x", 3);
  });

  it("evaluates if-else with braces in else branch", () => {
    assertValid("let mut x = 0; if (false) { x = 3; } else { x = 5; } x", 5);
  });

  it("rejects non-boolean condition in if statement", () => {
    assertInvalid("let mut x = 0; if (100) { x = 3; } else { x = 5; } x");
  });

  it("evaluates if-statement without else modifying mutable variable", () => {
    assertValid("let mut x = 0; if (true) { x = 3; } x", 3);
  });

  it("evaluates if-statement with false condition leaving variable unchanged", () => {
    assertValid("let mut x = 5; if (false) { x = 3; } x", 5);
  });

  it("supports += operator for addition assignment", () => {
    assertValid("let mut x = 0; x += 5; x", 5);
  });

  it("supports += with read input", () => {
    assertValid("let mut x = 0; x += read<I32>(); x", "100", 100);
  });

  it("supports += chaining with multiple operations", () => {
    assertValid("let mut x = 10; x += 5; x += 3; x", 18);
  });

  it("evaluates if-else as expression in let assignment", () => {
    assertValid("let x = if (true) 3 else 5; x", 3);
  });

  it("evaluates if-else expression with false condition", () => {
    assertValid("let x = if (false) 3 else 5; x", 5);
  });

  it("evaluates less-than comparison true", () => {
    assertValid("read<I32>() < read<I32>()", "1 2", 1);
  });

  it("evaluates less-than comparison false", () => {
    assertValid("read<I32>() < read<I32>()", "2 1", 0);
  });

  it("evaluates less-than with equal values as false", () => {
    assertValid("read<I32>() < read<I32>()", "1 1", 0);
  });

  it("sums numbers using while loop", () => {
    assertValid(
      "let mut sum = 0; let max = read<I32>(); let mut i = 0; while (i < max) { sum += i; i += 1; } sum",
      "10",
      45,
    );
  });

  it("declares and calls a function", () => {
    assertValid(
      "fn add(first : I32, second : I32) : I32 => first + second; add(3, 4)",
      "",
      7,
    );
  });

  it("declares a struct and sums two fields", () => {
    assertValid(
      "struct Point { x : I32; y : I32; } let point : Point = Point { x : read<I32>(), y : read<I32>() }; point.x + point.y",
      "3 4",
      7,
    );
  });

  it("uses mutable variable in closure with compound assignment", () => {
    assertValid(
      "let mut counter = 0; fn add() : Void => counter += read<I32>(); add(); counter",
      "1",
      1,
    );
  });

  it("declares singleton object with method and field access", () => {
    assertValid(
      "object MySingleton { let mut counter = 0; fn add() : Void => counter += read<I32>(); } MySingleton::add(); MySingleton::counter",
      "1",
      1,
    );
  });

  it("declares and calls generic function", () => {
    assertValid(
      "fn pass<T>(value : T) : T => value; pass<I32>(read<I32>())",
      "100",
      100,
    );
  });

  it("calls method with receiver syntax", () => {
    assertValid(
      "fn equalsTo(this : I32, other : I32) => this == other; 100.equalsTo(200)",
      "",
      0,
    );
  });
});
