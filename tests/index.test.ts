import { compileTuffToJS } from "../src/index";
import { Ok, Err } from "../src/types/result";

function evaluateCompiled(code: string, stdinValue?: string): unknown {
  if (stdinValue !== undefined) {
    return new Function("__stdin", code)(stdinValue);
  }
  return new Function(code)();
}

function getCompiledCodeOrFail(input: string): string {
  const result = compileTuffToJS(input);
  if (result.isErr()) {
    expect(result.error).toBeUndefined();
    return "";
  }
  return result.value;
}

function assertOk(input: string, expected: unknown, stdinValue?: string) {
  const code = getCompiledCodeOrFail(input);
  const evaluated = evaluateCompiled(code, stdinValue);
  expect(evaluated).toBe(expected);
}

function assertErr(input: string, expectedCode: string) {
  const result = compileTuffToJS(input);
  if (result.isErr()) {
    expect(result.error.code).toBe(expectedCode);
  } else {
    expect(result.value).toBeUndefined();
  }
}

function assertCompiles(input: string) {
  const code = getCompiledCodeOrFail(input);
  expect(code.length).toBeGreaterThan(0);
}

function assertOkIsErrReturnsFalse() {
  const ok = new Ok("value");
  expect(ok.isErr()).toBe(false);
}

function assertErrIsErrReturnsTrue() {
  const err = new Err("error");
  expect(err.isErr()).toBe(true);
}

describe("Result", () => {
  it("Ok.isErr returns false", () => assertOkIsErrReturnsFalse());
  it("Err.isErr returns true", () => assertErrIsErrReturnsTrue());
});

describe("compileTuffToJS", () => {
  it("compiles empty string to JS code that evaluates to 0", () =>
    assertOk("", 0));
  it("compiles '100' to JS code that evaluates to 100", () =>
    assertOk("100", 100));
  it("compiles '100U8' to JS code that evaluates to 100", () =>
    assertOk("100U8", 100));
  it("compiles '42F64' to JS code that evaluates to 42", () =>
    assertOk("42F64", 42));
  it("compiles 'true' to JS code that evaluates to 1", () =>
    assertOk("true", 1));
  it("compiles 'false' to JS code that evaluates to 0", () =>
    assertOk("false", 0));
  it("compiles non-numeric input by returning it as string expression", () =>
    assertOk("abc", "abc"));
  it("compiles negative number without type suffix as string", () =>
    assertOk("-100", "-100"));
  it("compiles negative text as string", () => assertOk("-abc", "-abc"));
  it("returns error for negative numbers with type suffixes", () =>
    assertErr("-100U8", "NEGATIVE_WITH_SUFFIX"));
  it("returns error for numbers that exceed their type suffix range", () =>
    assertErr("256U8", "VALUE_OUT_OF_RANGE"));
  it("compiles read<U8>() with stdin '100' to 100", () =>
    assertOk("read<U8>()", 100, "100"));
  it("returns error for read<> with unknown type", () =>
    assertErr("read<INVALID>()", "UNKNOWN_TYPE"));
  it("returns error for read<> with non-alphanumeric type", () =>
    assertErr("read<U@8>()", "UNKNOWN_TYPE"));
  it("compiles read<Bool>() with stdin 'true' to 1", () =>
    assertOk("read<Bool>()", 1, "true"));
  it("compiles read<Bool>() with stdin 'false' to 0", () =>
    assertOk("read<Bool>()", 0, "false"));
  it("compiles 'read<Bool>() && true' with stdin 'true' to 1", () =>
    assertOk("read<Bool>() && true", 1, "true"));
  it("compiles '100U8 + 50U8' to JS code that evaluates to 150", () =>
    assertOk("100U8 + 50U8", 150));
  it("compiles 'true && false' to JS code that evaluates to 0", () =>
    assertOk("true && false", 0));
  it("compiles 'true && true' to JS code that evaluates to 1", () =>
    assertOk("true && true", 1));
  it("compiles 'true || false' to JS code that evaluates to 1", () =>
    assertOk("true || false", 1));
  it("compiles 'false || false' to JS code that evaluates to 0", () =>
    assertOk("false || false", 0));
  it("compiles '!false' to JS code that evaluates to 1", () =>
    assertOk("!false", 1));
  it("compiles '!true' to JS code that evaluates to 0", () =>
    assertOk("!true", 0));
  it("compiles 'true == true' to JS code that evaluates to 1", () =>
    assertOk("true == true", 1));
  it("compiles 'true == false' to JS code that evaluates to 0", () =>
    assertOk("true == false", 0));
  it("compiles 'true != false' to JS code that evaluates to 1", () =>
    assertOk("true != false", 1));
  it("compiles 'false != false' to JS code that evaluates to 0", () =>
    assertOk("false != false", 0));
  it("compiles '1U8 < 2U8' to JS code that evaluates to 1", () =>
    assertOk("1U8 < 2U8", 1));
  it("compiles '2U8 < 1U8' to JS code that evaluates to 0", () =>
    assertOk("2U8 < 1U8", 0));
  it("compiles '2U8 <= 2U8' to JS code that evaluates to 1", () =>
    assertOk("2U8 <= 2U8", 1));
  it("compiles '3U8 > 2U8' to JS code that evaluates to 1", () =>
    assertOk("3U8 > 2U8", 1));
  it("compiles '3U8 >= 4U8' to JS code that evaluates to 0", () =>
    assertOk("3U8 >= 4U8", 0));
  it("compiles '3U8 == 3U8' to JS code that evaluates to 1", () =>
    assertOk("3U8 == 3U8", 1));
  it("compiles '3U8 != 3U8' to JS code that evaluates to 0", () =>
    assertOk("3U8 != 3U8", 0));
  it("compiles 'read<Bool>() == false' with stdin 'false' to 1", () =>
    assertOk("read<Bool>() == false", 1, "false"));
  it("compiles 'read<Bool>() != false' with stdin 'true' to 1", () =>
    assertOk("read<Bool>() != false", 1, "true"));
  it("compiles 'read<U8>() < 10U8' with stdin '9' to 1", () =>
    assertOk("read<U8>() < 10U8", 1, "9"));
  it("returns error when addition result exceeds type range", () =>
    assertErr("200U8 + 100U8", "VALUE_OUT_OF_RANGE"));
  it("compiles '100U8 - 30U8' to JS code that evaluates to 70", () =>
    assertOk("100U8 - 30U8", 70));
  it("compiles '10U8 * 5U8' to JS code that evaluates to 50", () =>
    assertOk("10U8 * 5U8", 50));
  it("compiles '100U8 / 4U8' to JS code that evaluates to 25", () =>
    assertOk("100U8 / 4U8", 25));
  it("returns error when operands have different types", () =>
    assertErr("100U8 + 50U16", "TYPE_MISMATCH"));
  it("returns error when left operand exceeds type range in binary operation", () =>
    assertErr("256U8 + 50U8", "VALUE_OUT_OF_RANGE"));
  it("returns error when right operand exceeds type range in binary operation", () =>
    assertErr("100U8 + 260U8", "VALUE_OUT_OF_RANGE"));
  it("compiles input with special characters as string", () =>
    assertOk("hello@world", "hello@world"));
  it("treats unrecognized type suffix as numeric only", () =>
    assertOk("100U9", 100));
  it("compiles 'read<U8>() + read<U8>()' with stdin '100 50' to 150", () =>
    assertOk("read<U8>() + read<U8>()", 150, "100 50"));
  it("compiles '100U8 + read<U8>()' with stdin '50' to 150", () =>
    assertOk("100U8 + read<U8>()", 150, "50"));
  it("compiles 'read<U8>() + 50U8' with stdin '100' to 150", () =>
    assertOk("read<U8>() + 50U8", 150, "100"));
  it("compiles 'read<U8>() - read<U8>()' with stdin '100 30' to 70", () =>
    assertOk("read<U8>() - read<U8>()", 70, "100 30"));
  it("compiles 'read<U8>() * read<U8>()' with stdin '10 5' to 50", () =>
    assertOk("read<U8>() * read<U8>()", 50, "10 5"));
  it("compiles 'read<U8>() / read<U8>()' with stdin '100 4' to 25", () =>
    assertOk("read<U8>() / read<U8>()", 25, "100 4"));
  it("returns error for invalid read type in binary operation", () =>
    assertErr("read<INVALID>() + 50U8", "UNKNOWN_TYPE"));
  it("returns error for non-alphanumeric read type in binary operation", () =>
    assertErr("read<U@8>() + 50U8", "UNKNOWN_TYPE"));
  it("returns error for literal exceeding type range in binary operation with read", () =>
    assertErr("256U8 + read<U8>()", "VALUE_OUT_OF_RANGE"));
  it("compiles 'read<U8>() + read<U8>() + read<U8>()' with stdin '1 2 3' to 6", () =>
    assertOk("read<U8>() + read<U8>() + read<U8>()", 6, "1 2 3"));
  it("compiles '10U8 + read<U8>() + 5U8' with stdin '20' to 35", () =>
    assertOk("10U8 + read<U8>() + 5U8", 35, "20"));
  it("compiles 'read<U8>() - read<U8>() - read<U8>()' with stdin '100 30 20' to 50", () =>
    assertOk("read<U8>() - read<U8>() - read<U8>()", 50, "100 30 20"));
  it("compiles '100U8 - read<U8>() - 10U8' with stdin '20' to 70", () =>
    assertOk("100U8 - read<U8>() - 10U8", 70, "20"));
  it("returns error for mismatched types in chained operation", () =>
    assertErr("10U8 + 20U16 + 5U8", "TYPE_MISMATCH"));
  it("returns error when chained operation result exceeds type range", () =>
    assertErr("200U8 + 100U8 + 100U8", "VALUE_OUT_OF_RANGE"));
  it("compiles 'let x : U8 = read<U8>(); x + x' with stdin '1' to 2", () =>
    assertOk("let x : U8 = read<U8>(); x + x", 2, "1"));
  it("compiles 'let x : U8 = 50U8; x + x' to 100", () =>
    assertOk("let x : U8 = 50U8; x + x", 100));
  it("compiles 'let x : Bool = true; x' to 1", () =>
    assertOk("let x : Bool = true; x", 1));
  it("compiles inferred Bool declaration", () =>
    assertOk("let x = false; x", 0));
  it("compiles Bool declaration from read initializer", () =>
    assertOk("let x : Bool = read<Bool>(); x", 1, "true"));
  it("compiles numeric comparison in Bool declaration", () =>
    assertOk("let x : Bool = 1U8 < 2U8; x", 1));
  it("compiles inferred comparison declaration", () =>
    assertOk("let x = 1U8 < 2U8; x", 1));
  it("compiles comparison assignment from numeric read", () =>
    assertOk("let mut x : Bool = false; x = read<U8>() < 10U8; x", 1, "9"));
  it("compiles numeric comparison after declarations", () =>
    assertOk("let x : U8 = 3U8; x > 2U8", 1));
  it("compiles Bool expression after declarations using read and variable", () =>
    assertOk("let x : Bool = true; read<Bool>() && x", 1, "true"));
  it("compiles unary Bool negation of variable after declarations", () =>
    assertOk("let x : Bool = true; !x", 0));
  it("compiles unary Bool negation of literal after declarations", () =>
    assertOk("let x : U8 = 1U8; !false", 1));
  it("compiles unary true negation after declarations", () =>
    assertOk("let x : U8 = 1U8; !true", 0));
  it("compiles bare Bool expression after declarations", () =>
    assertOk("let x : U8 = 1U8; true", 1));
  it("compiles bare Bool read after declarations", () =>
    assertOk("let x : U8 = 1U8; read<Bool>()", 0, "false"));
  it("compiles bare numeric read after declarations", () =>
    assertOk("let x : U8 = 1U8; read<U8>()", 7, "7"));
  it("compiles typed numeric literal after declarations", () =>
    assertOk("let x : U8 = 1U8; 42F64", 42));
  it("compiles negative numeric expression after declarations", () =>
    assertOk("let x : U8 = 1U8; -5", -5));
  it("compiles 'let x : U8 = read<U8>(); let y : U8 = read<U8>(); x + y' with stdin '10 20' to 30", () =>
    assertOk(
      "let x : U8 = read<U8>(); let y : U8 = read<U8>(); x + y",
      30,
      "10 20",
    ));
  it("compiles 'let x : U8 = 30U8; x - 10U8' to 20", () =>
    assertOk("let x : U8 = 30U8; x - 10U8", 20));
  it("compiles 'let x : U8 = read<U8>(); x * 3U8' with stdin '5' to 15", () =>
    assertOk("let x : U8 = read<U8>(); x * 3U8", 15, "5"));
  it("compiles 'let x : U8 = 100U8; x / 4U8' to 25", () =>
    assertOk("let x : U8 = 100U8; x / 4U8", 25));
  it("returns error for variable with invalid type", () =>
    assertErr("let x : INVALID = 50U8; x", "UNKNOWN_TYPE"));
  it("returns error for undefined variable usage", () =>
    assertErr("x + 10U8", "PARSE_ERROR"));
  it("returns error for type mismatch in variable initialization", () =>
    assertErr("let x : U8 = 300U8; x", "VALUE_OUT_OF_RANGE"));
  it("returns error for Bool and numeric type mismatch in declaration", () =>
    assertErr("let x : Bool = 1U8; x", "TYPE_MISMATCH"));
  it("returns error for numeric declaration initialized with Bool", () =>
    assertErr("let x : U8 = true; x", "TYPE_MISMATCH"));
  it("returns error for mismatched read type in variable initialization", () =>
    assertErr("let x : U8 = read<U16>(); x", "TYPE_MISMATCH"));
  it("returns first declaration error when later declarations exist", () =>
    assertErr(
      "let x : U8 = read<U16>(); let y : U8 = 1U8; x + y",
      "TYPE_MISMATCH",
    ));
  it("returns error for mismatched typed literal in variable initialization", () =>
    assertErr("let x : U8 = 10U16; x", "TYPE_MISMATCH"));
  it("returns error for type mismatch in variable operation", () =>
    assertErr("let x : U8 = 50U8; x + 20U16", "TYPE_MISMATCH"));
  it("returns error for invalid read type in expression after declarations", () =>
    assertErr("let x : U8 = 1U8; x + read<INVALID>()", "UNKNOWN_TYPE"));
  it("returns error for unary negation of numeric value after declarations", () =>
    assertErr("let x : U8 = 1U8; !x", "PARSE_ERROR"));
  it("returns error for invalid unary Bool read after declarations", () =>
    assertErr("let x : U8 = 1U8; !read<INVALID>()", "UNKNOWN_TYPE"));
  it("returns error for Bool and numeric comparison mix", () =>
    assertErr("1U8 < true", "TYPE_MISMATCH"));
  it("returns error for numeric and Bool comparison mix", () =>
    assertErr("false >= 1U8", "TYPE_MISMATCH"));
  it("returns error for chained comparisons", () =>
    assertErr("1U8 < 2U8 < 3U8", "PARSE_ERROR"));
  it("returns error for comparison in numeric declaration", () =>
    assertErr("let x : U8 = 1U8 < 2U8; x", "TYPE_MISMATCH"));
  it("returns error for chained comparisons in Bool declaration", () =>
    assertErr("let x : Bool = 1U8 < 2U8 < 3U8; x", "PARSE_ERROR"));
  it("returns error for chained comparisons after declarations", () =>
    assertErr("let x : U8 = 1U8; x < 2U8 < 3U8", "PARSE_ERROR"));
  it("returns error for Bool ordering comparison", () =>
    assertErr("true < false", "TYPE_MISMATCH"));
  it("returns error for Bool ordering comparison after declarations", () =>
    assertErr("let x : Bool = true; x < false", "TYPE_MISMATCH"));
  it("returns error for Bool mixed with numeric operand", () =>
    assertErr("true + 1U8", "TYPE_MISMATCH"));
  it("returns error for numeric operand mixed with Bool", () =>
    assertErr("1U8 + true", "TYPE_MISMATCH"));
  it("returns error for Bool arithmetic", () =>
    assertErr("true + false", "PARSE_ERROR"));
  it("returns error for Bool arithmetic after declarations", () =>
    assertErr("let x : U8 = 1U8; true + false", "PARSE_ERROR"));
  it("compiles constant Bool chain after declarations", () =>
    assertOk("let x : U8 = 1U8; true && false", 0));
  it("compiles 'let x : U16 = read<U16>(); x / 2U16' with stdin '100' to 50", () =>
    assertOk("let x : U16 = read<U16>(); x / 2U16", 50, "100"));
  it("compiles chain with variable: 'let a : U8 = 5U8; a + a + 10U8' to 20", () =>
    assertOk("let a : U8 = 5U8; a + a + 10U8", 20));
  it("compiles 'let x : S8 = read<S8>(); x - 10S8' with stdin '-5' to -15", () =>
    assertOk("let x : S8 = read<S8>(); x - 10S8", -15, "-5"));
  it("compiles 'let m : U8 = 10U8; let n : U8 = 20U8; let p : U8 = 30U8; m + n + p' to 60", () =>
    assertOk(
      "let m : U8 = 10U8; let n : U8 = 20U8; let p : U8 = 30U8; m + n + p",
      60,
    ));
  it("returns error for variable used before declaration", () =>
    assertErr("x + 10U8; let x : U8 = 5U8", "PARSE_ERROR"));
  it("returns error for invalid variable name", () =>
    assertErr("let x@y : U8 = 10U8; x@y", "PARSE_ERROR"));
  it("compiles declaration-only input to default return 0", () =>
    assertOk("let x : U8 = 10U8;", 0));
  it("compiles expression containing read<> after declarations", () =>
    assertCompiles("let x : U8 = 10U8; x + read<U8>()"));
  it("returns error for undefined variable in expression after declaration", () =>
    assertErr("let x : U8 = 10U8; y + 1U8", "PARSE_ERROR"));
  it("returns error for variable declaration missing ':'", () =>
    assertErr("let x U8 = 10U8; x", "PARSE_ERROR"));
  it("returns error for variable declaration missing '='", () =>
    assertErr("let x : U8 10U8; x", "PARSE_ERROR"));
  it("returns error for variable declaration missing ';'", () =>
    assertErr("let x : U8 = 10U8 x", "PARSE_ERROR"));
  it("compiles inferred let declaration", () =>
    assertOk("let x = 10U8; x + 1U8", 11));
  it("compiles inferred let declaration with read initializer", () =>
    assertOk("let x = read<U8>(); x + 1U8", 2, "1"));
  it("compiles typed declaration without initializer when not read", () =>
    assertOk("let x: U8; 10U8 + 5U8", 15));
  it("returns error for read of typed declaration without initializer", () =>
    assertErr("let x: U8; x + 1U8", "PARSE_ERROR"));
  it("returns error for declaration missing both type and initializer", () =>
    assertErr("let x; x", "PARSE_ERROR"));
  it("returns error for declaration with empty initializer", () =>
    assertErr("let x = ; x", "PARSE_ERROR"));
  it("returns error when inferred declaration uses unknown initializer form", () =>
    assertErr("let x = hello; x", "PARSE_ERROR"));
  it("returns error for immutable let reassignment", () =>
    assertErr("let x: U8 = 1U8; x = 2U8; x", "PARSE_ERROR"));
  it("allows same-scope let redeclaration with latest declaration winning", () =>
    assertOk("let x: U8 = 1U8; let x: U8 = 2U8; x + 1U8", 3));
  it("returns error for type mismatch in inferred declaration operation", () =>
    assertErr("let x = 1U8; x + 1U16", "TYPE_MISMATCH"));
  it("returns error for annotation mismatch in typed declaration", () =>
    assertErr("let x: U8 = 1U16; x", "TYPE_MISMATCH"));
  it("returns error for out-of-scope use after declaration block", () =>
    assertErr("let x: U8 = 1U8; y + x", "PARSE_ERROR"));
  it("compiles mutable inferred declaration with reassignment", () =>
    assertOk("let mut x = 0U8; x = 1U8; x", 1));
  it("compiles mutable inferred declaration with multiple reassignments", () =>
    assertOk("let mut x = 0U8; x = 1U8; x = 2U8; x", 2));
  it("compiles mutable typed declaration without initializer after assignment", () =>
    assertOk("let mut x: U8; x = 7U8; x + 1U8", 8));
  it("returns error for reading mutable typed declaration before first assignment", () =>
    assertErr("let mut x: U8; x + 1U8", "PARSE_ERROR"));
  it("returns error for mutable declaration missing type and initializer", () =>
    assertErr("let mut x; x", "PARSE_ERROR"));
  it("returns error for assignment to immutable declaration", () =>
    assertErr("let x = 0U8; x = 1U8; x", "PARSE_ERROR"));
  it("returns error for mutable reassignment type mismatch", () =>
    assertErr("let mut x = 0U8; x = 1U16; x", "TYPE_MISMATCH"));
  it("returns error for mutable reassignment before declaration", () =>
    assertErr("x = 1U8; let mut x = 0U8; x", "PARSE_ERROR"));
  it("compiles mutable reassignment from read initializer", () =>
    assertOk("let mut x: U8 = 0U8; x = read<U8>(); x + 1U8", 2, "1"));
  it("compiles mutable Bool reassignment from Bool read", () =>
    assertOk("let mut x: Bool = false; x = read<Bool>(); x", 1, "true"));
  it("compiles mutable Bool reassignment from Bool literal", () =>
    assertOk("let mut x: Bool = false; x = true; x", 1));
  it("returns error for chained comparison assignment", () =>
    assertErr(
      "let mut x: Bool = false; x = 1U8 < 2U8 < 3U8; x",
      "PARSE_ERROR",
    ));
  it("returns error for mutable reassignment with invalid read type", () =>
    assertErr("let mut x: U8 = 0U8; x = read<INVALID>(); x", "UNKNOWN_TYPE"));
  it("returns error for assignment to undefined variable after declarations", () =>
    assertErr("let mut x = 0U8; y = 1U8; x", "PARSE_ERROR"));
  it("returns error for assignment statement missing semicolon", () =>
    assertErr("let mut x = 0U8; x = 1U8 x", "PARSE_ERROR"));
  it("returns error for assignment statement missing value", () =>
    assertErr("let mut x = 0U8; x = ; x", "PARSE_ERROR"));
  it("returns error for assignment with non-typed and non-read value", () =>
    assertErr("let mut x = 0U8; x = hello; x", "PARSE_ERROR"));
  it("returns error for malformed standalone assignment starting with '='", () =>
    assertErr("= 1U8", "PARSE_ERROR"));
  it("returns error for malformed standalone assignment ending with '='", () =>
    assertErr("x =", "PARSE_ERROR"));
  it("compiles declaration with extra spaces after let", () =>
    assertOk("let   x = 1U8; x + 1U8", 2));
});
