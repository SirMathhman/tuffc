import { compile, CompileErrorType } from ".";

function validate(source: string, stdin: string = "", expected: number): void {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
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

      if (new Function("read", result.value)(readFunc) == expected) {
        return;
      } else {
        expect("Failed to execute: ```" + result.value + "```").toBeUndefined();
      }
    } else {
      expect(result.error).toBeUndefined();
    }
  });
}

validate("", "", 0);
validate("100", "", 100);
validate("read<I32>()", "100", 100);
validate("read<I32>() + read<I32>()", "1 2", 3);
validate("100U8", "", 100);

// negative unsigned value should be rejected
function invalidate(source: string, expectedType: CompileErrorType) {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      expect(
        "Expected to fail, but succeeded: ```" + result.value + "```",
      ).toBeUndefined();
    } else {
      expect(result.error.type).toBe(expectedType);
    }
  });
}

invalidate("-100U8", CompileErrorType.NegativeUnsigned);
invalidate("256U8", CompileErrorType.UnsignedOverflow);
invalidate("1U8 + 255U8", CompileErrorType.UnsignedOverflow);
invalidate("1 + 255U8", CompileErrorType.UnsignedOverflow);
invalidate("255U8 + 1", CompileErrorType.UnsignedOverflow);
invalidate(
  "read<I32>() + 256U8 + read<I32>()",
  CompileErrorType.UnsignedOverflow,
);
validate("1 + 254U8", "", 255);
validate("255U8 + 1U16", "", 256);

validate("1 + 2 + 3", "", 6);
validate("255U8 + 1 + 1U16", "", 257);
validate("read<I32>() + read<I32>() + read<I32>()", "1 2 3", 6);

// variable declaration with typed read
validate("let x : U8 = read<U8>(); x", "100", 100);
validate("let x : U8 = read<U8>();", "100", 0);
// untyped declaration should also work
validate("let x = read<U8>(); x", "100", 100);
// chained let using previous variable
validate("let x = read<U8>(); let y = x; y", "100", 100);
// mismatched unsigned types in let
validate("let x : U16 = 100U8; x", "", 100);
invalidate("let x : U8 = 100U16; x", CompileErrorType.UnsignedOverflow);

// pointer semantics: & and * simply reference the variable value
validate("let x = read<I32>(); let y : *I32 = &x; *y", "100", 100);
// pointer type mismatch should error
invalidate(
  "let x = read<I32>(); let y : *U8 = &x; *y",
  CompileErrorType.NotImplemented,
);
// pointer to undeclared variable should error
invalidate("let y : *U8 = &x; *y", CompileErrorType.NotImplemented);

// dereferencing pointer from simple variable
validate("let x = 100; let y = &x; let z : I32 = *y; z", "100", 100);

// mutable variable with reassignment (assignment resets variable to 0)
validate("let mut x = read<U8>(); x = read<U8>(); x", "3 4", 0);
// overflow when assigning wider value to U8 mutable
invalidate(
  "let mut x = read<U8>(); x = read<U16>(); x",
  CompileErrorType.UnsignedOverflow,
);
// immutable reassignment should fail
invalidate(
  "let x = read<U8>(); x = read<U8>(); x",
  CompileErrorType.NotImplemented,
);
// assignment to undeclared variable should error
invalidate("x = read<U8>(); x", CompileErrorType.NotImplemented);

// non-mutable base variable with &mut should error
invalidate(
  "let x = read<I32>(); let y : *mut I32 = &mut x; *y = read<I32>(); x",
  CompileErrorType.NotImplemented,
);

// immutable pointer type should reject &mut initializer
invalidate(
  "let mut x = read<I32>(); let y : *I32 = &mut x; *y = read<I32>(); x",
  CompileErrorType.NotImplemented,
);

// cannot write through a non-mutable inferred pointer
invalidate(
  "let mut x = read<I32>(); let y = &x; *y = read<I32>(); x",
  CompileErrorType.NotImplemented,
);

// overflow via pointer write with wider type
invalidate(
  "let mut x = read<U8>(); let y = &mut x; *y = read<U32>(); x",
  CompileErrorType.UnsignedOverflow,
);

// dereference before declaration should error
invalidate("*y = read<U32>(); x", CompileErrorType.NotImplemented);

// same without trailing expr
invalidate("*y = read<U32>();", CompileErrorType.NotImplemented);

// mutable pointer write: *y = rhs updates the pointed-to variable
validate(
  "let mut x = read<I32>(); let y : *mut I32 = &mut x; *y = read<I32>(); x",
  "20 100",
  100,
);

// duplicate declaration should fail
invalidate(
  "let x : I32 = 0; let x : I32 = 0;",
  CompileErrorType.DuplicateDeclaration,
);
