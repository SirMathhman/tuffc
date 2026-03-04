import { compile } from ".";

function validate(source: string, stdin: string = "", expected: number): void {
  it(source, () => {
    const result = compile(source);
    if (typeof result === "object" && "error" in result) {
      expect(`Unexpected compilation error: ${result.error}`).toBeUndefined();
      return;
    }
    const compiled = result.value;
    const tokens = stdin
      .split(" ")
      .flatMap((part) => part.split("\n"))
      .flatMap((part) => part.split("\t"))
      .filter((part) => part.length > 0);
    let tokenIndex = 0;
    const readFunc = () => {
      const part = tokens[tokenIndex++] ?? "0";
      if (part === "true") return 1;
      if (part === "false") return 0;
      return parseInt(part, 10);
    };

    if (new Function("read", compiled)(readFunc) == expected) {
      return;
    } else {
      expect("Failed to execute: ```" + compiled + "```").toBeUndefined();
    }
  });
}

// Test cases for validate() function

// Basic read tests
validate("read<U8>()", "100", 100);
validate("read<U8>()", "0", 0);
validate("read<U8>()", "255", 255);

// Multiple reads
validate("read<U8>() + read<U8>()", "10 20", 30);
validate("read<U8>() * read<U8>()", "5 6", 30);

// Edge cases with whitespace/newlines
validate("read<U8>()", "100\n", 100);
validate("read<U8>()", "100\t", 100);
validate("read<U8>()", "\n100", 100);

// Multiple tokens with various separators
validate("read<U8>() + read<U8>() + read<U8>()", "1 2 3", 6);
validate("read<U8>() + read<U8>() + read<U8>()", "1\n2\n3", 6);
validate("read<U8>() + read<U8>() + read<U8>()", "1\t2\t3", 6);

// Boolean conversion
validate("read()", "true", 1);
validate("read()", "false", 0);

// Default value (no input)
validate("read()", "", 0);
validate("read<U8>()", "", 0);

// Literal syntax with type annotations
validate("100U8", "", 100);
validate("0U8", "", 0);
validate("255U8", "", 255);
validate("100U8 + 50U8", "", 150);

// Variable declaration with type annotations
validate("let x : U8 = read<U8>(); x", "100", 100);

// Mutable variable with reassignment
validate("let mut x = read<U8>(); x = read<U8>(); x", "1 2", 2);

// Type inference from literals
validate("let x = 100U8; x", "", 100);
validate("let y = 50U16; y", "", 50);
validate("let z = 10U32; z", "", 10);

// Mutable variable with type inference
validate("let mut x = 5U8; x = 10U8; x", "", 10);

// Error cases: immutability enforcement, redeclaration, temporal dead zone
invalidate("let x = 100U8; x = 50U8"); // immutable by default
invalidate("let x = 5U8; let x = 10U8"); // redeclaration forbidden
invalidate("x = 5U8; let x = 10U8"); // use before declaration (TDZ)
invalidate("let x = 100U8; let x = 100U8; x"); // redeclaration
invalidate("let mut x = 50U8; let x = 100U8"); // redeclaration even with mut

function invalidate(source: string): void {
  it(`rejects ${source}`, () => {
    const result = compile(source);
    if (typeof result === "object" && "error" in result) {
      return;
    } else {
      expect("Expected compilation to fail").toBeUndefined();
    }
  });
}

// Negative literal error cases
invalidate("-100U8");
invalidate("-1U8");
invalidate("-0U8");
invalidate("100U8 + -50U8");

// Out of range literal cases
invalidate("256U8"); // U8 max is 255
invalidate("65536U16"); // U16 max is 65535
invalidate("128I8"); // I8 max is 127
invalidate("-129I8"); // I8 min is -128
