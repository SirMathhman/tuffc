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
    const result = compile("256U8");
    expect(result.type).toBe("err");
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
});
