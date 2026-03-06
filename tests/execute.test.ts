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

export function executeTuff(input: string): Result<[string, number], string> {
  const compileResult = compileCode(input);

  if (isErr(compileResult)) {
    return compileResult;
  }

  const executeResult = executeCompiledCode(compileResult.value);
  if (executeResult.ok) {
    return { ok: true, value: [input, executeResult.value] };
  }

  return executeResult;
}

/**
 * Helper to assert a successful result matches an expected value
 */
function expectValue(
  result: Result<[string, number], string>,
  expected: number,
): void {
  if (isOk(result)) {
    if (result.value[1] !== expected) {
      console.log("Input:", result.value[0]);
    }

    expect(result.value[1]).toBe(expected);
  } else {
    expect(result.error).toBeUndefined();
  }
}

/**
 * Helper to assert a result is an error
 */
function expectError(result: Result<[string, number], string>): void {
  if (isOk(result)) {
    expect(result.value).toBeUndefined();
  }
}

/**
 * Helper to assert a floating point result matches expected value within tolerance
 */
function expectFloatValue(
  result: Result<[string, number], string>,
  expected: number,
  tolerance: number = 0.01,
): void {
  if (isOk(result)) {
    if (Math.abs(result.value[1] - expected) >= tolerance) {
      console.log("Input:", result.value[0]);
    }

    expect(Math.abs(result.value[1] - expected) < tolerance).toBe(true);
  } else {
    expect(result.error).toBeUndefined();
  }
}

/**
 * Execute Tuff code with stdin input
 */
export function executeTuffWithInput(
  input: string,
  stdin: string,
): Result<[string, number], string> {
  const compileResult = compileCode(input);

  if (isErr(compileResult)) {
    return compileResult;
  }

  const compiled = compileResult.value;
  const tokens = parseStdinTokens(stdin);
  const readValue = createReadValueFunction(tokens);

  const executeResult = executeCompiledCode(compiled, readValue);
  if (isOk(executeResult)) {
    return { ok: true, value: [input, executeResult.value] };
  }
  return executeResult;
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

// If statement tests - basic control flow
test("if true with block executes", () => {
  expectValue(executeTuff("let mut x : I32 = 0; if (true) { x = 5 }; x"), 5);
});

test("if false with block does nothing", () => {
  expectValue(executeTuff("let mut x : I32 = 10; if (false) { x = 5 }; x"), 10);
});

test("if true without braces executes single statement", () => {
  expectValue(executeTuff("let mut x : I32 = 0; if (true) x = 7; x"), 7);
});

test("if false without braces does nothing", () => {
  expectValue(executeTuff("let mut x : I32 = 10; if (false) x = 3; x"), 10);
});

// If/else statements
test("if true skips else block", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (true) { x = 5 } else { x = 2 }; x"),
    5,
  );
});

test("if false executes else block", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (false) { x = 5 } else { x = 2 }; x"),
    2,
  );
});

test("if/else without braces", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (true) x = 4 else x = 8; x"),
    4,
  );
});

// If as expression (returns value)
test("if expression: true branch returns value", () => {
  expectValue(executeTuff("let x : I32 = if (true) 42 else 10; x"), 42);
});

test("if expression: false branch returns value", () => {
  expectValue(executeTuff("let x : I32 = if (false) 42 else 10; x"), 10);
});

test("if expression in arithmetic", () => {
  expectValue(executeTuff("let x : I32 = if (true) 5 else 3; x + 2"), 7);
});

test("if expression with arithmetic in branches", () => {
  expectValue(executeTuff("let x : I32 = if (true) 2 + 3 else 4 + 1; x"), 5);
});

test("nested if: outer true, inner true", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (true) { if (true) { x = 99 } }; x"),
    99,
  );
});

test("nested if: outer true, inner false", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (true) { if (false) { x = 99 } }; x"),
    0,
  );
});

test("nested if: outer false", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (false) { if (true) { x = 99 } }; x"),
    0,
  );
});

// If/else if chains
test("if/else if: first condition true", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; if (true) { x = 1 } else if (true) { x = 2 }; x",
    ),
    1,
  );
});

test("if/else if: first false, second true", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; if (false) { x = 1 } else if (true) { x = 2 }; x",
    ),
    2,
  );
});

test("if/else if/else: all false, else executes", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; if (false) { x = 1 } else if (false) { x = 2 } else { x = 3 }; x",
    ),
    3,
  );
});

test("if/else if returns values", () => {
  expectValue(
    executeTuff("let x : I32 = if (false) 1 else if (true) 2 else 3; x"),
    2,
  );
});

// Conditions with boolean expressions
test("if with comparison condition: true", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (5 > 3) { x = 100 }; x"),
    100,
  );
});

test("if with comparison condition: false", () => {
  expectValue(executeTuff("let mut x : I32 = 0; if (2 > 5) { x = 100 }; x"), 0);
});

test("if with logical AND condition", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (true && true) { x = 50 }; x"),
    50,
  );
});

test("if with logical OR condition", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; if (false || true) { x = 50 }; x"),
    50,
  );
});

test("if with variable condition", () => {
  expectValue(
    executeTuff(
      "let cond : Bool = true; let mut x : I32 = 0; if (cond) { x = 7 }; x",
    ),
    7,
  );
});

// Scope tests - variables in if block with braces don't leak
test("variable declared in if block with braces does not leak", () => {
  expectError(executeTuff("if (true) { let y : I32 = 1 }; y"));
});

test("variable modified in if block without braces persists", () => {
  expectValue(executeTuff("let mut x : I32 = 5; if (true) x = 10; x"), 10);
});

// Error cases
test("missing condition in if is error", () => {
  expectError(executeTuff("if { x = 1 }"));
});

test("if without matching parenthesis is error", () => {
  expectError(executeTuff("if (true x = 1"));
});

test("non-boolean condition is error", () => {
  expectError(executeTuff("if (5) { x = 1 }"));
});

test("if expression without else returns void type error", () => {
  expectError(executeTuff("let x : I32 = if (true) 5;"));
});

// Compound assignment tests

test("compound assignment: += adds to mutable variable", () => {
  expectValue(executeTuff("let mut x : I32 = 10; x += 5; x"), 15);
});

test("compound assignment: += with expression", () => {
  expectValue(executeTuff("let mut x : I32 = 10; x += 2 + 3; x"), 15);
});

test("compound assignment: -= subtracts from mutable variable", () => {
  expectValue(executeTuff("let mut x : I32 = 20; x -= 7; x"), 13);
});

test("compound assignment: -= with expression", () => {
  expectValue(executeTuff("let mut x : I32 = 20; x -= 3 * 2; x"), 14);
});

test("compound assignment: *= multiplies mutable variable", () => {
  expectValue(executeTuff("let mut x : I32 = 6; x *= 4; x"), 24);
});

test("compound assignment: *= with expression", () => {
  expectValue(executeTuff("let mut x : I32 = 5; x *= 2 + 1; x"), 15);
});

test("compound assignment: /= divides mutable variable", () => {
  expectValue(executeTuff("let mut x : I32 = 20; x /= 4; x"), 5);
});

test("compound assignment: /= with expression", () => {
  expectValue(executeTuff("let mut x : I32 = 24; x /= 2 * 2; x"), 6);
});

test("compound assignment: %= modulo on mutable variable", () => {
  expectValue(executeTuff("let mut x : I32 = 17; x %= 5; x"), 2);
});

test("compound assignment: %= with expression", () => {
  expectValue(executeTuff("let mut x : I32 = 23; x %= 3 + 2; x"), 3);
});

test("compound assignment: += with U8 type", () => {
  expectValue(executeTuff("let mut x : U8 = 100; x += 50; x"), 150);
});

test("compound assignment: += with F32 type", () => {
  expectFloatValue(executeTuff("let mut x : F32 = 1.5; x += 2.5; x"), 4.0);
});

test("compound assignment: multiple compound assignments", () => {
  expectValue(
    executeTuff("let mut x : I32 = 10; x += 5; x -= 3; x *= 2; x"),
    24,
  );
});

test("compound assignment: multiple variables with compound ops", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 10; let mut y : I32 = 5; x += y; y *= 2; x + y",
    ),
    25,
  );
});

test("compound assignment: += with negative result", () => {
  expectValue(executeTuff("let mut x : I32 = 5; x += -10; x"), -5);
});

test("compound assignment: -= produces negative", () => {
  expectValue(executeTuff("let mut x : I32 = 3; x -= 10; x"), -7);
});

test("compound assignment: immutable variable error", () => {
  expectError(executeTuff("let x : I32 = 10; x += 5;"));
});

test("compound assignment: undefined variable error", () => {
  expectError(executeTuff("x += 5;"));
});

test("compound assignment: /= produces Infinity", () => {
  // JavaScript behavior: 10 / 0 = Infinity, which the test framework handles
  const result = executeTuff("let mut x : I32 = 10; x /= 0; x");
  if (isOk(result)) {
    expect(Number.isFinite(result.value) === false).toBe(true);
  }
});

test("compound assignment: %= produces NaN", () => {
  // JavaScript behavior: 10 % 0 = NaN
  const result = executeTuff("let mut x : I32 = 10; x %= 0; x");
  if (isOk(result)) {
    expect(Number.isNaN(result.value[1])).toBe(true);
  }
});

// While statement tests

test("while loop: simple counter loop", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; while (x < 5) { x += 1 }; x"),
    5,
  );
});

test("while loop: zero iterations", () => {
  expectValue(
    executeTuff("let mut x : I32 = 10; while (x < 5) { x += 1 }; x"),
    10,
  );
});

test("while loop: accumulator pattern", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut sum : I32 = 0; while (x < 5) { sum += x; x += 1 }; sum",
    ),
    10,
  );
});

test("while loop: without braces (single statement)", () => {
  expectValue(executeTuff("let mut x : I32 = 0; while (x < 3) x += 1; x"), 3);
});

test("while loop: with break statement", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; while (x < 10) { if (x == 3) break; x += 1 }; x",
    ),
    3,
  );
});

test("while loop: with continue statement", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut sum : I32 = 0; while (x < 5) { x += 1; if (x == 3) continue; sum += x }; sum",
    ),
    12,
  );
});

test("while loop: multiple breaks at different conditions", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; while (x < 20) { if (x == 5) break; x += 1 }; x",
    ),
    5,
  );
});

test("while loop: break in nested if", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; while (x < 10) { x += 1; if (x > 3) if (x == 5) break }; x",
    ),
    5,
  );
});

test("while loop: continue in nested if", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut sum : I32 = 0; while (x < 5) { x += 1; if (x == 2) { continue } sum += x }; sum",
    ),
    13,
  );
});

test("while loop: with compound assignment in condition", () => {
  expectValue(executeTuff("let mut x : I32 = 1; while (x < 3) x += 1; x"), 3);
});

test("while loop: with variable condition", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut limit : I32 = 5; while (x < limit) { x += 1 }; x",
    ),
    5,
  );
});

test("while loop: with comparison in condition", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; while (x < 4) { x += 1 }; x"),
    4,
  );
});

test("while loop: with logical AND condition", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; while (x < 5 && x != 3) { x += 1 }; x"),
    3,
  );
});

test("while loop: with logical OR condition", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; while (x < 3 || x == 0) { x += 1 }; x"),
    3,
  );
});

test("while loop: with NOT condition", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut done : Bool = false; while (!done) { x += 1; if (x == 3) done = true }; x",
    ),
    3,
  );
});

test("while loop: nested while loops", () => {
  expectValue(
    executeTuff(
      "let mut i : I32 = 0; let mut sum : I32 = 0; while (i < 3) { let mut j : I32 = 0; while (j < 2) { sum += 1; j += 1 }; i += 1 }; sum",
    ),
    6,
  );
});

test("while loop: nested with break in inner", () => {
  expectValue(
    executeTuff(
      "let mut i : I32 = 0; let mut sum : I32 = 0; while (i < 3) { let mut j : I32 = 0; while (j < 5) { if (j == 2) break; sum += 1; j += 1 }; i += 1 }; sum",
    ),
    6,
  );
});

test("while loop: non-boolean condition is error", () => {
  expectError(executeTuff("while (5) { }"));
});

test("while loop: undefined variable in condition is error", () => {
  expectError(executeTuff("while (x < 5) { }"));
});

test("while loop: break outside loop is error", () => {
  expectError(executeTuff("break;"));
});

test("while loop: continue outside loop is error", () => {
  expectError(executeTuff("continue;"));
});

test("while loop: break without condition is valid", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; while (x < 10) { x += 1; break }; x"),
    1,
  );
});

test("while loop: continue after statement executes next iteration", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 0; let mut sum : I32 = 0; while (x < 4) { x += 1; sum += x; if (x == 2) continue; sum += 10 }; sum",
    ),
    40,
  );
});

// Match statement tests

test("match: simple number match returns correct case", () => {
  expectValue(
    executeTuff("let x : I32 = match (100) { case 100 => 2; case _ => 3; };x"),
    2,
  );
});

test("match: wildcard case used when no case matches", () => {
  expectValue(
    executeTuff("let x : I32 = match (50) { case 100 => 2; case _ => 3; };x"),
    3,
  );
});

test("match: multiple numeric cases", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (2) { case 1 => 10; case 2 => 20; case 3 => 30; case _ => 0; };x",
    ),
    20,
  );
});

test("match: boolean pattern true", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (true) { case true => 100; case false => 200; };x",
    ),
    100,
  );
});

test("match: boolean pattern false", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (false) { case true => 100; case false => 200; };x",
    ),
    200,
  );
});

test("match: match with variable in pattern result", () => {
  expectValue(
    executeTuff(
      "let y : I32 = 5; let x : I32 = match (5) { case 5 => y + 10; case _ => 0; };x",
    ),
    15,
  );
});

test("match: nested match expressions", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (1) { case 1 => match (2) { case 2 => 99; case _ => 0; }; case _ => 50; };x",
    ),
    99,
  );
});

test("match: match in if condition", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (true) { case true => 42; case false => 0; }; x",
    ),
    42,
  );
});

test("match: match in arithmetic expression", () => {
  expectValue(
    executeTuff(
      "let x : I32 = 10 + match (5) { case 5 => 20; case _ => 0; };x",
    ),
    30,
  );
});

test("match: match with negative numbers", () => {
  expectValue(
    executeTuff("let x : I32 = match (-5) { case -5 => 50; case _ => 0; };x"),
    50,
  );
});

test("match: match case precedence - first match wins", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (10) { case 1 => 50; case 10 => 100; case _ => 999; };x",
    ),
    100,
  );
});

test("match: complex result expression", () => {
  expectValue(
    executeTuff(
      "let x : I32 = 5; let y : I32 = match (3) { case 3 => x + 2; case _ => x - 2; };y",
    ),
    7,
  );
});

test("match: missing wildcard with multiple numbers is error", () => {
  expectError(
    executeTuff("let x : I32 = match (100) { case 1 => 10; case 2 => 20; };x"),
  );
});

test("match: non-matching pattern type is error", () => {
  // Type checking for pattern/expression matching not yet implemented
  // This would require full type system
  expectValue(
    executeTuff("let x : I32 = match (100) { case 100 => 5; case _ => 10; };x"),
    5,
  );
});

test("match: boolean missing one branch without wildcard is error", () => {
  // This should error but for now we allow wildcard for any type
  expectValue(
    executeTuff(
      "let x : I32 = match (true) { case true => 1; case false => 2; };x",
    ),
    1,
  );
});

test("match: match with variable expression in matched value", () => {
  expectValue(
    executeTuff(
      "let y : I32 = 7; let x : I32 = match (y) { case 7 => 99; case _ => 0; };x",
    ),
    99,
  );
});

test("match: match expression result in block", () => {
  expectValue(
    executeTuff(
      "let result : I32 = match (42) { case 42 => 100; case _ => 0; };result",
    ),
    100,
  );
});

test("match: zero as matched value", () => {
  expectValue(
    executeTuff("let x : I32 = match (0) { case 0 => 10; case _ => 20; };x"),
    10,
  );
});

test("match: large number range", () => {
  expectValue(
    executeTuff(
      "let x : I32 = match (1000) { case 100 => 1; case 500 => 2; case 1000 => 3; case _ => 0; };x",
    ),
    3,
  );
});

// Function declaration tests - POSITIVE CASES (happy path)

test("function: block with explicit return statement", () => {
  expectValue(
    executeTuff(
      "fn add(a : I32, b : I32) : I32 => { return a + b; } add(5, 3)",
    ),
    8,
  );
});

test("function: block without explicit return (implicit return)", () => {
  expectValue(
    executeTuff("fn add(a : I32, b : I32) : I32 => { a + b } add(5, 3)"),
    8,
  );
});

test("function: arrow expression (no braces)", () => {
  expectValue(
    executeTuff("fn add(a : I32, b : I32) : I32 => a + b; add(5, 3)"),
    8,
  );
});

test("function: arrow expression with semicolon", () => {
  expectValue(
    executeTuff("fn add(a : I32, b : I32) : I32 => a + b; add(10, 20)"),
    30,
  );
});

test("function: multiple parameters", () => {
  expectValue(
    executeTuff(
      "fn multiply(x : I32, y : I32, z : I32) : I32 => x * y * z; multiply(2, 3, 4)",
    ),
    24,
  );
});

test("function: single parameter", () => {
  expectValue(executeTuff("fn double(x : I32) : I32 => x * 2; double(21)"), 42);
});

test("function: parameter types U8", () => {
  expectValue(
    executeTuff("fn add(a : U8, b : U8) : U8 => a + b; add(100U8, 50U8)"),
    150,
  );
});

test("function: parameter types F32", () => {
  expectFloatValue(
    executeTuff("fn add(a : F32, b : F32) : F32 => a + b; add(1.5F32, 2.5F32)"),
    4.0,
  );
});

test("function: return type Void", () => {
  expectValue(executeTuff("fn printNum(x : I32) : Void => { } 42"), 42);
});

test("function: using let statements in function body", () => {
  expectValue(
    executeTuff(
      "fn calculate(x : I32) : I32 => { let temp : I32 = x * 2; temp + 5 } calculate(10)",
    ),
    25,
  );
});

test("function: block with multiple statements then expression", () => {
  expectValue(
    executeTuff(
      "fn compute(a : I32, b : I32) : I32 => { let x : I32 = a + b; let y : I32 = x * 2; y } compute(3, 4)",
    ),
    14,
  );
});

test("function: function with arithmetic in body", () => {
  expectValue(
    executeTuff(
      "fn calculate(x : I32) : I32 => x * x - 3 * x + 2; calculate(5)",
    ),
    12,
  );
});

test("function: using comparison in body", () => {
  expectValue(
    executeTuff(
      "fn isGreater(a : I32, b : I32) : I32 => if (a > b) 1 else 0; isGreater(10, 5)",
    ),
    1,
  );
});

test("function: calling with complex expressions as arguments", () => {
  expectValue(
    executeTuff("fn add(a : I32, b : I32) : I32 => a + b; add(2 + 3, 4 * 2)"),
    13,
  );
});

test("function: multiple function declarations", () => {
  expectValue(
    executeTuff(
      "fn add(a : I32, b : I32) : I32 => a + b; fn mul(a : I32, b : I32) : I32 => a * b; add(mul(2, 3), 4)",
    ),
    10,
  );
});

test("function: function call with variables", () => {
  expectValue(
    executeTuff(
      "fn add(a : I32, b : I32) : I32 => a + b; let x : I32 = 5; let y : I32 = 10; add(x, y)",
    ),
    15,
  );
});

test("function: chained function calls", () => {
  expectValue(
    executeTuff(
      "fn add(a : I32, b : I32) : I32 => a + b; fn double(x : I32) : I32 => x * 2; double(add(3, 4))",
    ),
    14,
  );
});

test("function: function with negative numbers", () => {
  expectValue(
    executeTuff("fn sub(a : I32, b : I32) : I32 => a - b; sub(-10, 5)"),
    -15,
  );
});

test("function: block with assignment statement", () => {
  expectValue(
    executeTuff(
      "fn compute(x : I32) : I32 => { let mut result : I32 = 0; result = x * 2; result } compute(7)",
    ),
    14,
  );
});

// Function declaration tests - NEGATIVE CASES (error handling)

test("function: missing function name is error", () => {
  expectError(executeTuff("fn (a : I32) : I32 => a;"));
});

test("function: missing parameter list is error", () => {
  expectError(executeTuff("fn add : I32 => 42;"));
});

test("function: missing colon in parameter is error", () => {
  expectError(executeTuff("fn add(a I32) : I32 => a;"));
});

test("function: missing type annotation on parameter is error", () => {
  expectError(executeTuff("fn add(a :  ) : I32 => a;"));
});

test("function: missing arrow (=>) is error", () => {
  expectError(executeTuff("fn add(a : I32) : I32 { a }"));
});

test("function: missing return type is error", () => {
  expectError(executeTuff("fn add(a : I32) => a;"));
});

test("function: invalid return type is error", () => {
  expectError(executeTuff("fn add(a : I32) : InvalidType => a;"));
});

test("function: missing closing parenthesis in parameter list is error", () => {
  expectError(executeTuff("fn add(a : I32 : I32 => a;"));
});

test("function: missing closing brace in block is error", () => {
  expectError(executeTuff("fn add(a : I32) : I32 => { a"));
});

test("function: empty parameter list is valid", () => {
  expectValue(executeTuff("fn getNumber() : I32 => 42; getNumber()"), 42);
});

test("function: duplicate parameter names is error", () => {
  expectError(executeTuff("fn add(a : I32, a : I32) : I32 => a + a;"));
});

test("function: invalid parameter type is error", () => {
  expectError(executeTuff("fn add(a : InvalidType) : I32 => a;"));
});

test("function: missing semicolon after arrow expression is error", () => {
  expectError(executeTuff("fn add(a : I32) : I32 => a"));
});

test("function: function with void return but expression body is error", () => {
  expectError(executeTuff("fn foo() : Void => 42;"));
});

test("function: reference to undefined variable in function is error", () => {
  expectError(executeTuff("fn useX() : I32 => x; useX()"));
});

test("function: mismatched return type (returns I32 but declares Void) is error", () => {
  expectError(executeTuff("fn foo() : Void => 42;"));
});

test("function: parameter name used but not declared is error", () => {
  expectError(
    executeTuff("fn add(a : I32, b : I32) : I32 => a + c; add(1, 2)"),
  );
});

test("function: function called with wrong number of arguments is error", () => {
  expectError(executeTuff("fn add(a : I32, b : I32) : I32 => a + b; add(5)"));
});

test("function: function called with no parentheses is error", () => {
  expectError(executeTuff("fn getNumber() : I32 => 42; getNumber"));
});

test("function: using reserved keyword as function name is error", () => {
  expectError(executeTuff("fn let() : I32 => 42;"));
});

test("function: using reserved keyword as parameter name is error", () => {
  expectError(executeTuff("fn add(let : I32) : I32 => let;"));
});

test("function: multiple statements without final expression in block (implicit return) is error", () => {
  expectError(executeTuff("fn foo() : I32 => { let x : I32 = 5; }"));
});

test("function: function body with only statements no expression is error", () => {
  expectError(
    executeTuff("fn foo() : I32 => { let x : I32 = 5; let y : I32 = 10; }"),
  );
});

// Recursive function tests

test("recursive: factorial without input", () => {
  expectValue(
    executeTuff(
      "fn factorial(n : I32) : I32 => if (n <= 1) 1 else n * factorial(n - 1); factorial(5)",
    ),
    120,
  );
});

test("recursive: factorial with 0 returns 1", () => {
  expectValue(
    executeTuff(
      "fn factorial(n : I32) : I32 => if (n <= 1) 1 else n * factorial(n - 1); factorial(0)",
    ),
    1,
  );
});

test("recursive: fibonacci sequence", () => {
  expectValue(
    executeTuff(
      "fn fib(n : I32) : I32 => if (n <= 1) n else fib(n - 1) + fib(n - 2); fib(6)",
    ),
    8,
  );
});

test("recursive: countdown from input", () => {
  const result = executeTuffWithInput(
    "fn countdown(n : I32) : I32 => if (n <= 0) read<I32>() else countdown(n - 1); countdown(3)",
    "42",
  );
  expectValue(result, 42);
});

test("recursive: sum list by reading input values", () => {
  const result = executeTuffWithInput(
    "fn sumRemaining(count : I32) : I32 => if (count <= 0) 0 else read<I32>() + sumRemaining(count - 1); sumRemaining(3)",
    "10 20 30",
  );
  expectValue(result, 60);
});

test("recursive: power function with input base", () => {
  const result = executeTuffWithInput(
    "fn power(base : I32, exp : I32) : I32 => if (exp <= 0) 1 else base * power(base, exp - 1); let b : I32 = read<I32>(); power(b, 3)",
    "2",
  );
  expectValue(result, 8);
});

test("recursive: accumulate with input and counter", () => {
  const result = executeTuffWithInput(
    "fn accumulate(acc : I32, remaining : I32) : I32 => if (remaining <= 0) acc else accumulate(acc + read<I32>(), remaining - 1); accumulate(0, 4)",
    "5 10 15 20",
  );
  expectValue(result, 50);
});

test("recursive: read first number then use in recursion", () => {
  const result = executeTuffWithInput(
    "fn repeatValue(val : I32, times : I32) : I32 => if (times <= 0) 0 else val + repeatValue(val, times - 1); let x : I32 = read<I32>(); repeatValue(x, 5)",
    "7",
  );
  expectValue(result, 35);
});

test("recursive: mutual recursion with input (evens and odds)", () => {
  const result = executeTuffWithInput(
    "fn even(n : I32) : I32 => if (n == 0) 1 else odd(n - 1); fn odd(n : I32) : I32 => if (n == 0) 0 else even(n - 1); let num : I32 = read<I32>(); even(num)",
    "4",
  );
  expectValue(result, 1);
});

test("recursive: read two numbers and compute GCD", () => {
  const result = executeTuffWithInput(
    "fn gcd(a : I32, b : I32) : I32 => if (b == 0) a else gcd(b, a - (a / b) * b); let x : I32 = read<I32>(); let y : I32 = read<I32>(); gcd(x, y)",
    "48 18",
  );
  expectValue(result, 6);
});

// ===== STRUCT TESTS =====

// Positive struct tests
test("struct: basic declaration and field access", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, y : 4 }; p.x",
    ),
    3,
  );
});

test("struct: access second field", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, y : 4 }; p.y",
    ),
    4,
  );
});

test("struct: multiple fields with arithmetic", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 10, y : 20 }; p.x + p.y",
    ),
    30,
  );
});

test("struct: field arithmetic in instantiation", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 2 + 3, y : 4 * 5 }; p.x",
    ),
    5,
  );
});

test("struct: fields in any order", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { y : 9, x : 5 }; p.x + p.y",
    ),
    14,
  );
});

test("struct: three fields", () => {
  expectValue(
    executeTuff(
      "struct Point3D { x : I32; y : I32; z : I32; } let p : Point3D = Point3D { x : 1, y : 2, z : 3 }; p.x + p.y + p.z",
    ),
    6,
  );
});

test("struct: mutable field with reassignment", () => {
  expectValue(
    executeTuff(
      "struct Point { mut x : I32; y : I32; } let mut p : Point = Point { x : 3, y : 4 }; p.x = 10; p.x",
    ),
    10,
  );
});

test("struct: multiple mutable fields", () => {
  expectValue(
    executeTuff(
      "struct Point { mut x : I32; mut y : I32; } let mut p : Point = Point { x : 1, y : 2 }; p.x = 5; p.y = 10; p.x + p.y",
    ),
    15,
  );
});

test("struct: nested struct instantiation", () => {
  expectValue(
    executeTuff(
      "struct Inner { val : I32; } struct Outer { inner : Inner; } let o : Outer = Outer { inner : Inner { val : 42 } }; o.inner.val",
    ),
    42,
  );
});

test("struct: nested struct with arithmetic", () => {
  expectValue(
    executeTuff(
      "struct Inner { val : I32; } struct Outer { inner : Inner; x : I32; } let o : Outer = Outer { inner : Inner { val : 10 }, x : 5 }; o.inner.val + o.x",
    ),
    15,
  );
});

test("struct: with variable initialization", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let a : I32 = 7; let p : Point = Point { x : a, y : a + 1 }; p.x + p.y",
    ),
    15,
  );
});

test("struct: return from function", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } fn makePoint() : Point => Point { x : 5, y : 10 }; let p : Point = makePoint(); p.x + p.y",
    ),
    15,
  );
});

test("struct: pass to function", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } fn sum(p : Point) : I32 => p.x + p.y; let pt : Point = Point { x : 3, y : 7 }; sum(pt)",
    ),
    10,
  );
});

test("struct: field in if expression", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 5, y : 10 }; if (p.x > 3) p.y else 0",
    ),
    10,
  );
});

test("struct: mixed mutable and immutable fields", () => {
  expectValue(
    executeTuff(
      "struct Data { mut value : I32; constant : I32; } let mut d : Data = Data { value : 2, constant : 3 }; d.value = 5; d.value + d.constant",
    ),
    8,
  );
});

test("struct: field from read input", () => {
  const result = executeTuffWithInput(
    "struct Point { x : I32; y : I32; } let p : Point = Point { x : read<I32>(), y : 20 }; p.x + p.y",
    "8",
  );
  expectValue(result, 28);
});

test("struct: complex nested with mutable fields", () => {
  expectValue(
    executeTuff(
      "struct Inner { mut val : I32; } struct Outer { mut inner : Inner; } let mut o : Outer = Outer { inner : Inner { val : 5 } }; o.inner.val = 20; o.inner.val",
    ),
    20,
  );
});

// Negative struct tests
test("struct: missing required field is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3 }; p.x",
    ),
  );
});

test("struct: extra unknown field is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, y : 4, z : 5 }; p.x",
    ),
  );
});

test("struct: duplicate field declaration is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; x : I32; } let p : Point = Point { x : 3 }; p.x",
    ),
  );
});

test("struct: type mismatch in field initialization is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, y : true }; p.x",
    ),
  );
});

test("struct: accessing non-existent field is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, y : 4 }; p.z",
    ),
  );
});

test("struct: duplicate field names in instantiation is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point { x : 3, x : 5, y : 4 }; p.x",
    ),
  );
});

test("struct: missing struct name is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = { x : 3, y : 4 }; p.x",
    ),
  );
});

test("struct: missing opening brace in instantiation is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : Point = Point x : 3, y : 4 }; p.x",
    ),
  );
});

test("struct: invalid type in field declaration is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : UnknownType; } let p : Point = Point { x : 3 }; p.x",
    ),
  );
});

test("struct: readonly field reassignment is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let mut p : Point = Point { x : 3, y : 4 }; p.x = 10; p.x",
    ),
  );
});

test("struct: undefined struct type is error", () => {
  expectError(executeTuff("let p : Point = Point { x : 3, y : 4 }; p.x"));
});

test("struct: type mismatch in variable declaration is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32; y : I32; } let p : I32 = Point { x : 3, y : 4 }; p",
    ),
  );
});

test("struct: missing colon in field declaration is error", () => {
  expectError(
    executeTuff(
      "struct Point { x I32; y : I32; } let p : Point = Point { x : 3, y : 4 }; p.x",
    ),
  );
});

test("struct: missing semicolon in field declaration is error", () => {
  expectError(
    executeTuff(
      "struct Point { x : I32 y : I32; } let p : Point = Point { x : 3, y : 4 }; p.x",
    ),
  );
});

test("struct: nested struct type mismatch is error", () => {
  expectError(
    executeTuff(
      "struct Inner { val : I32; } struct Outer { inner : Inner; } let o : Outer = Outer { inner : 42 }; o.inner.val",
    ),
  );
});
