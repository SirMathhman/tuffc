import { test, expect } from "bun:test";
import { compile as compileTuffToJS } from "../src/compile";
import { type Result, isOk, isErr } from "../src/types";

/**
 * Executes compiled code by creating a new Function from the compiled
 * string and running it. The result of the function is coerced to a number.
 * Returns a Result to avoid throwing exceptions.
 */
/**
 * Parse whitespace-separated tokens from stdin
 */
function parseStdinTokens(stdin: string): string[] {
  const stdinTrimmed = stdin.trim();
  const tokens: string[] = [];
  let currentToken = "";

  for (let i = 0; i < stdinTrimmed.length; i++) {
    const char = stdinTrimmed[i];
    const isWhitespace =
      char === " " || char === "\t" || char === "\n" || char === "\r";

    if (isWhitespace) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}

/**
 * Create a readValue function for stdin token consumption
 */
function createReadValueFunction(tokens: string[]): () => number {
  let tokenIndex = 0;

  return (): number => {
    if (tokenIndex >= tokens.length) {
      return 0;
    }
    const token = tokens[tokenIndex];
    tokenIndex++;
    return Number(token);
  };
}

/**
 * Compile Tuff code to executable JavaScript
 */
function compileCode(input: string): Result<string, string> {
  const compileResult = compileTuffToJS(input);
  if (isErr(compileResult)) {
    return compileResult;
  }
  return { ok: true, value: compileResult.value };
}

/**
 * Execute compiled code with optional stdin context
 */
function executeCompiledCode(
  compiled: string,
  readValue?: () => number,
): Result<number, string> {
  const fn = readValue
    ? new Function("readValue", compiled)
    : new Function(compiled);
  const result = readValue ? fn(readValue) : fn();
  return { ok: true, value: Number(result) };
}

export function executeTuff(input: string): Result<number, string> {
  const compileResult = compileCode(input);

  if (isErr(compileResult)) {
    return compileResult;
  }

  return executeCompiledCode(compileResult.value);
}

/**
 * Helper to assert a successful result matches an expected value
 */
function expectValue(result: Result<number, string>, expected: number): void {
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toBe(expected);
  }
}

/**
 * Helper to assert a result is an error
 */
function expectError(result: Result<number, string>): void {
  expect(isErr(result)).toBe(true);
}

/**
 * Execute Tuff code with stdin input
 */
export function executeTuffWithInput(
  input: string,
  stdin: string,
): Result<number, string> {
  const compileResult = compileCode(input);

  if (isErr(compileResult)) {
    return compileResult;
  }

  const compiled = compileResult.value;
  const tokens = parseStdinTokens(stdin);
  const readValue = createReadValueFunction(tokens);

  return executeCompiledCode(compiled, readValue);
}

test("execute with empty string returns 0", () => {
  expectValue(executeTuff(""), 0);
});

test("execute 100U8 returns 100", () => {
  expectValue(executeTuff("100U8"), 100);
});

// Positive integers with various types
test("positive integer with U16", () => {
  expectValue(executeTuff("1000U16"), 1000);
});

test("positive integer with I32", () => {
  expectValue(executeTuff("42I32"), 42);
});

test("positive integer with U64", () => {
  expectValue(executeTuff("999999U64"), 999999);
});

// Negative integers with signed types
test("negative integer with I8", () => {
  expectValue(executeTuff("-100I8"), -100);
});

test("negative integer with I32", () => {
  expectValue(executeTuff("-42I32"), -42);
});

// Floating point numbers
test("float with F32 type", () => {
  expectValue(executeTuff("3.14F32"), 3.14);
});

test("float with F64 type", () => {
  expectValue(executeTuff("2.71828F64"), 2.71828);
});

test("float without type defaults to F32", () => {
  expectValue(executeTuff("5.5"), 5.5);
});

test("negative float with F64", () => {
  expectValue(executeTuff("-1.5F64"), -1.5);
});

// Invalid inputs - should return error Result
test("invalid type annotation returns error", () => {
  expectError(executeTuff("100I128"));
});

test("negative unsigned type returns error", () => {
  expectError(executeTuff("-100U8"));
});

test("non-numeric input returns error", () => {
  expectError(executeTuff("abc"));
});

test("input with whitespace returns error", () => {
  expectError(executeTuff("100 U8"));
});

test("leading whitespace returns error", () => {
  expectError(executeTuff(" 100U8"));
});

// Arithmetic expressions
test("simple addition", () => {
  expectValue(executeTuff("2U8 + 3U8"), 5);
});

test("simple subtraction", () => {
  expectValue(executeTuff("5I32 - 2I32"), 3);
});

test("simple multiplication", () => {
  expectValue(executeTuff("3U8 * 4U8"), 12);
});

test("simple division", () => {
  expectValue(executeTuff("10I32 / 2I32"), 5);
});

test("operator precedence: multiplication before addition", () => {
  expectValue(executeTuff("2I32 + 3I32 * 4I32"), 14);
});

test("parentheses override precedence", () => {
  expectValue(executeTuff("(2I32 + 3I32) * 4I32"), 20);
});

test("type widening: U8 + U16", () => {
  expectValue(executeTuff("2U8 + 3U16"), 5);
});

test("addition without whitespace", () => {
  expectValue(executeTuff("2U8+3U8"), 5);
});

test("multiple additions", () => {
  expectValue(executeTuff("1I32 + 2I32 + 3I32"), 6);
});

// stdin-based reads
test("read single value from stdin", () => {
  const result = executeTuffWithInput("read<U8>()", "100");
  expectValue(result, 100);
});

test("read multiple values from stdin", () => {
  const result = executeTuffWithInput("read<U8>() + read<U8>()", "3 4");
  expectValue(result, 7);
});

test("read with expression", () => {
  const result = executeTuffWithInput("read<I32>() * 2I32", "5");
  expectValue(result, 10);
});

test("read multiple values in complex expression", () => {
  const result = executeTuffWithInput(
    "read<U8>() + read<U8>() * read<U8>()",
    "2 3 4",
  );
  expectValue(result, 14);
});

// Variable binding with let
test("simple variable declaration and use", () => {
  expectValue(executeTuff("let x : U8 = 100; x"), 100);
});

test("variable in arithmetic expression", () => {
  expectValue(executeTuff("let x : U8 = 3; x + 5"), 8);
});

test("multiple variable declarations", () => {
  expectValue(executeTuff("let x : U8 = 3; let y : U8 = 4; x + y"), 7);
});

test("variable with mutable binding and reassignment", () => {
  expectValue(executeTuff("let mut x : U8 = 0; x = 5; x"), 5);
});

test("variable with multiple reassignments", () => {
  expectValue(executeTuff("let mut x : U8 = 1; x = 2; x = 3; x"), 3);
});

test("variable initialized from read", () => {
  const result = executeTuffWithInput("let x : U8 = read<U8>(); x", "42");
  expectValue(result, 42);
});

test("multiple variables with reads", () => {
  const result = executeTuffWithInput(
    "let x : U8 = read<U8>(); let y : U8 = read<U8>(); x + y",
    "10 20",
  );
  expectValue(result, 30);
});

test("variable in complex expression", () => {
  expectValue(executeTuff("let x : U8 = 2; let y : U8 = 3; x + y * 4"), 14);
});

test("mutable variable reassigned from read", () => {
  const result = executeTuffWithInput(
    "let mut x : U8 = 0; x = read<U8>(); x",
    "99",
  );
  expectValue(result, 99);
});

test("immutable variable reassignment error", () => {
  expectError(executeTuff("let x : U8 = 5; x = 10; x"));
});

test("undefined variable error", () => {
  expectError(executeTuff("x"));
});

test("duplicate variable declaration error", () => {
  expectError(executeTuff("let x : U8 = 1; let x : U8 = 2; x"));
});

test("variable without initializer error", () => {
  expectError(executeTuff("let x : U8; x"));
});

test("type mismatch in variable initializer", () => {
  expectError(executeTuff("let x : U8 = -5; x"));
});

// Boolean literal tests
test("boolean literal true returns 1", () => {
  expectValue(executeTuff("true"), 1);
});

test("boolean literal false returns 0", () => {
  expectValue(executeTuff("false"), 0);
});

test("boolean variable declaration", () => {
  expectValue(executeTuff("let x : Bool = true; x"), 1);
});

test("boolean variable false", () => {
  expectValue(executeTuff("let x : Bool = false; x"), 0);
});

// Comparison operator tests
test("less than: true case", () => {
  expectValue(executeTuff("1 < 2"), 1);
});

test("less than: false case", () => {
  expectValue(executeTuff("2 < 1"), 0);
});

test("greater than: true case", () => {
  expectValue(executeTuff("5 > 3"), 1);
});

test("greater than: false case", () => {
  expectValue(executeTuff("2 > 5"), 0);
});

test("less than or equal: true case", () => {
  expectValue(executeTuff("3 <= 3"), 1);
});

test("less than or equal: false case", () => {
  expectValue(executeTuff("4 <= 3"), 0);
});

test("greater than or equal: true case", () => {
  expectValue(executeTuff("5 >= 5"), 1);
});

test("greater than or equal: false case", () => {
  expectValue(executeTuff("3 >= 4"), 0);
});

test("equal: true case", () => {
  expectValue(executeTuff("42 == 42"), 1);
});

test("equal: false case", () => {
  expectValue(executeTuff("3 == 5"), 0);
});

test("not equal: true case", () => {
  expectValue(executeTuff("2 != 3"), 1);
});

test("not equal: false case", () => {
  expectValue(executeTuff("4 != 4"), 0);
});

// Logical operator tests
test("logical AND: true && true", () => {
  expectValue(executeTuff("true && true"), 1);
});

test("logical AND: true && false", () => {
  expectValue(executeTuff("true && false"), 0);
});

test("logical AND: false && true", () => {
  expectValue(executeTuff("false && true"), 0);
});

test("logical OR: true || false", () => {
  expectValue(executeTuff("true || false"), 1);
});

test("logical OR: false || false", () => {
  expectValue(executeTuff("false || false"), 0);
});

test("logical NOT: !true", () => {
  expectValue(executeTuff("!true"), 0);
});

test("logical NOT: !false", () => {
  expectValue(executeTuff("!false"), 1);
});

test("comparison in variable", () => {
  expectValue(executeTuff("let x : Bool = 1 < 5; x"), 1);
});

test("logical AND with comparisons", () => {
  expectValue(executeTuff("(1 < 2) && (3 > 2)"), 1);
});

test("logical OR with comparisons", () => {
  expectValue(executeTuff("(1 > 2) || (3 < 5)"), 1);
});

test("NOT with boolean literal", () => {
  expectValue(executeTuff("let x : Bool = !false; x"), 1);
});
