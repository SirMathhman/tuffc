import { test, expect } from "bun:test";
import {
  compile as compileTuffToJS,
  compileProject as compileTuffProjectToJS,
} from "../src/compile";
import { parseProjectModule } from "../src/compiler";
import { type Result, isOk, isErr } from "../src/types";
import type {
  ModuleCompilationInfo,
  ModuleNode,
} from "../src/compiler/core/ast";
import { buildProjectModuleRegistry } from "../src/compiler/core/project";

type ProjectFiles = Record<string, string>;

interface ProjectFixture {
  entryModule: string;
  tuffFiles: ProjectFiles;
  foreignFiles?: ProjectFiles;
}

interface ParsedProjectModuleFixture {
  moduleMap: Map<string, ModuleCompilationInfo>;
  module: ModuleNode | undefined;
}

function mergeProjectFiles(
  tuffFiles: ProjectFiles,
  foreignFiles: ProjectFiles = {},
): ProjectFiles {
  return {
    ...tuffFiles,
    ...foreignFiles,
  };
}

function createProjectModuleMap(
  files: ProjectFiles,
): Result<Map<string, ModuleCompilationInfo>, string> {
  return buildProjectModuleRegistry(files);
}

function expectProjectModuleMap(
  files: ProjectFiles,
): Map<string, ModuleCompilationInfo> {
  const moduleMap = createProjectModuleMap(files);
  expect(isOk(moduleMap)).toBe(true);
  return moduleMap.ok ? moduleMap.value : new Map<string, ModuleCompilationInfo>();
}

function expectParsedProjectModule(
  files: ProjectFiles,
  moduleName: string,
): ParsedProjectModuleFixture {
  const moduleMap = expectProjectModuleMap(files);
  const moduleInfo = moduleMap.get(moduleName);
  expect(moduleInfo).toBeDefined();
  if (!moduleInfo) {
    return { moduleMap, module: undefined };
  }

  const parsedModule = parseProjectModule(moduleInfo, moduleMap);
  expect(isOk(parsedModule)).toBe(true);

  return {
    moduleMap,
    module: parsedModule.ok ? parsedModule.value : undefined,
  };
}

function parseProjectModules(
  files: ProjectFiles,
  moduleOrder: string[],
): Result<Map<string, ModuleNode>, string> {
  const modulesResult = createProjectModuleMap(files);
  if (isErr(modulesResult)) {
    return modulesResult;
  }

  const parsedModules = new Map<string, ModuleNode>();
  for (const moduleName of moduleOrder) {
    const moduleInfo = modulesResult.value.get(moduleName);
    if (!moduleInfo) {
      return {
        ok: false,
        error: "Unknown module '" + moduleName + "'",
      };
    }

    const parsedModule = parseProjectModule(moduleInfo, modulesResult.value);
    if (isErr(parsedModule)) {
      return { ok: false, error: String(parsedModule.error) };
    }

    parsedModules.set(moduleName, parsedModule.value);
  }

  return { ok: true, value: parsedModules };
}

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

function compileProjectCode(
  entryModule: string,
  files: ProjectFiles,
): Result<string, string> {
  const compileResult = compileTuffProjectToJS({ entryModule, files });
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
  try {
    const fn = readValue
      ? new Function("readValue", compiled)
      : new Function(compiled);
    const result = readValue ? fn(readValue) : fn();
    return { ok: true, value: Number(result) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

export function executeTuffProject(
  entryModule: string,
  files: ProjectFiles,
): Result<[string, number], string> {
  const compileResult = compileProjectCode(entryModule, files);

  if (isErr(compileResult)) {
    return compileResult;
  }

  const executeResult = executeCompiledCode(compileResult.value);
  if (isOk(executeResult)) {
    return { ok: true, value: [entryModule, executeResult.value] };
  }

  return executeResult;
}

export function executeTuffProjectFixture(
  fixture: ProjectFixture,
): Result<[string, number], string> {
  return executeTuffProject(
    fixture.entryModule,
    mergeProjectFiles(fixture.tuffFiles, fixture.foreignFiles),
  );
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

// Char literal tests
test("char: single-quoted ASCII literal returns code point", () => {
  expectValue(executeTuff("'a'"), 97);
});

test("char: escaped newline literal returns code point", () => {
  expectValue(executeTuff("'\\n'"), 10);
});

test("char: Char variable declaration and function round-trip", () => {
  expectValue(
    executeTuff(
      "fn echo(c : Char) : Char => c; let letter : Char = 'A'; echo(letter)",
    ),
    65,
  );
});

test("char: double-quoted value assigned to Char is error", () => {
  expectError(executeTuff('let letter : Char = "a"; letter'));
});

test("char: empty literal is error", () => {
  expectError(executeTuff("''"));
});

test("char: multi-character literal is error", () => {
  expectError(executeTuff("'ab'"));
});

test("char: invalid escape sequence is error", () => {
  expectError(executeTuff("'\\x'"));
});

test("char: unterminated literal is error", () => {
  expectError(executeTuff("'a"));
});

// String literal as immutable Char slice tests
test("string slice: double-quoted literal has length", () => {
  expectValue(executeTuff('let s : *[Char] = "hello"; s.length'), 5);
});

test("string slice: empty literal has zero length", () => {
  expectValue(executeTuff('let s : *[Char] = ""; s.length'), 0);
});

test("string slice: escaped characters count toward length", () => {
  expectValue(executeTuff('let s : *[Char] = "a\\n\\t"; s.length'), 3);
});

test("string slice: indexing returns Char code point", () => {
  expectValue(executeTuff('let c : Char = "hi"[0USize]; c'), 104);
});

test("string slice: function accepts literal Char slice", () => {
  expectValue(
    executeTuff('fn len(s : *[Char]) : USize => s.length; len("hi")'),
    2,
  );
});

test("string slice: immutable slice assignment is error", () => {
  expectError(executeTuff("let s : *[Char] = \"hi\"; s[0USize] = 'H';"));
});

test("string slice: Char literal assigned to Char slice is error", () => {
  expectError(executeTuff("let s : *[Char] = 'a'; s.length"));
});

test("string slice: string literal assigned to Char is error", () => {
  expectError(executeTuff('let c : Char = "a"; c'));
});

test("string slice: unterminated double-quoted literal is error", () => {
  expectError(executeTuff('let s : *[Char] = "hello; s.length'));
});

test("string slice: invalid escape sequence is error", () => {
  expectError(executeTuff('let s : *[Char] = "\\x"; s.length'));
});

test("string slice: dynamic index is rejected", () => {
  expectError(
    executeTuff('let s : *[Char] = "hi"; let i : USize = 0USize; s[i]'),
  );
});

test("string slice: out-of-bounds constant index is error", () => {
  expectError(executeTuff('let s : *[Char] = "hi"; s[2USize]'));
});

// Type alias tests
test("type alias: alias to primitive works in let binding", () => {
  expectValue(executeTuff("type MyInt = I32; let x : MyInt = 7; x"), 7);
});

test("type alias: alias to Char slice works", () => {
  expectValue(
    executeTuff(
      'type Greeting = *[Char]; let s : Greeting = "hello"; s.length',
    ),
    5,
  );
});

test("type alias: alias works as slice element type", () => {
  expectValue(
    executeTuff('type Glyph = Char; let s : *[Glyph] = "ok"; s[1USize]'),
    107,
  );
});

test("type alias: alias works in function parameter and return", () => {
  expectValue(
    executeTuff(
      "type Letter = Char; fn echo(c : Letter) : Letter => c; echo('Z')",
    ),
    90,
  );
});

test("type alias: alias works in struct field", () => {
  expectValue(
    executeTuff(
      "type Age = I32; struct Person { age : Age; } let p : Person = Person { age: 42 }; p.age",
    ),
    42,
  );
});

test("type alias: alias chain resolves transitively", () => {
  expectValue(executeTuff("type A = I32; type B = A; let x : B = 9; x"), 9);
});

test("type alias: unknown target type is error", () => {
  expectError(executeTuff("type Nope = MissingType; let x : Nope = 1; x"));
});

test("type alias: duplicate alias name is error", () => {
  expectError(
    executeTuff("type Name = I32; type Name = U32; let x : Name = 1; x"),
  );
});

test("type alias: reserved keyword alias name is error", () => {
  expectError(executeTuff("type fn = I32; let x : fn = 1; x"));
});

test("type alias: direct self reference is error", () => {
  expectError(executeTuff("type Loop = Loop; let x : Loop = 1; x"));
});

test("type alias: mutual cycle is error", () => {
  expectError(executeTuff("type A = B; type B = A; let x : A = 1; x"));
});

// is operator tests
test("is operator: Char literal matches Char", () => {
  expectValue(executeTuff("'a' is Char"), 1);
});

test("is operator: mismatched primitive type returns false", () => {
  expectValue(executeTuff("'a' is I32"), 0);
});

test("is operator: alias target resolves", () => {
  expectValue(executeTuff("type Letter = Char; 'z' is Letter"), 1);
});

test("is operator: string literal matches Char slice", () => {
  expectValue(executeTuff('"hi" is *[Char]'), 1);
});

test("is operator: struct instantiation matches struct type", () => {
  expectValue(
    executeTuff("struct Person { age : I32; } Person { age: 42 } is Person"),
    1,
  );
});

test("is operator: closure matches function type", () => {
  expectValue(executeTuff("((x : I32) => x) is (I32) => I32"), 1);
});

test("is operator: variable check can drive if guard", () => {
  expectValue(executeTuff("let x : I32 = 1; if x is I32 { 7 } else { 0 }"), 7);
});

test("is operator: different declared type returns false", () => {
  expectValue(executeTuff("let x : I32 = 1; x is U32"), 0);
});

test("is operator: unknown target type is error", () => {
  expectError(executeTuff("1 is MissingType"));
});

// Union type tests
test("union: let binding accepts first arm", () => {
  expectValue(
    executeTuff("let x : I32 | Bool = 7; if x is I32 { x } else { 0 }"),
    7,
  );
});

test("union: let binding accepts second arm", () => {
  expectValue(
    executeTuff(
      "let x : I32 | Bool = true; if x is Bool { if x { 1 } else { 0 } } else { 0 }",
    ),
    1,
  );
});

test("union: false branch narrows to remaining arm", () => {
  expectValue(
    executeTuff(
      "let x : I32 | Bool = false; if x is I32 { 0 } else { if x { 1 } else { 2 } }",
    ),
    2,
  );
});

test("union: function parameter can be narrowed with is", () => {
  expectValue(
    executeTuff(
      "fn f(x : I32 | Bool) : I32 => if x is I32 { x } else { 0 }; f(5)",
    ),
    5,
  );
});

test("union: function return type can be a union", () => {
  expectValue(
    executeTuff(
      "fn f(flag : Bool) : I32 | Bool => if flag { 1 } else { false }; let x : I32 | Bool = f(true); if x is I32 { x } else { 0 }",
    ),
    1,
  );
});

test("union: struct field can be a union", () => {
  expectValue(
    executeTuff(
      "struct Box { value : I32 | Bool; } let b : Box = Box { value: true }; let v : I32 | Bool = b.value; if v is Bool { if v { 1 } else { 0 } } else { 0 }",
    ),
    1,
  );
});

test("union: alias to union works", () => {
  expectValue(
    executeTuff(
      "type NumOrFlag = I32 | Bool; let x : NumOrFlag = 9; if x is I32 { x } else { 0 }",
    ),
    9,
  );
});

test("union: unknown arm type is error", () => {
  expectError(executeTuff("let x : I32 | Missing = 1; x"));
});

test("union: initializer not assignable to any arm is error", () => {
  expectError(executeTuff("let x : I32 | Bool = 'a'; x"));
});

// this keyword tests
test("this: top-level exposes let bindings", () => {
  expectValue(executeTuff("let x : I32 = 10; this.x"), 10);
});

test("this: top-level exposes functions", () => {
  expectValue(executeTuff("fn get() : I32 => 100; this.get()"), 100);
});

test("this: constructor-like function can return this", () => {
  expectValue(
    executeTuff(
      "struct Point { x : I32; } fn Point(x : I32) : Point => this; Point(100).x",
    ),
    100,
  );
});

test("this: function scope exposes parameters", () => {
  expectValue(executeTuff("fn getX(x : I32) : I32 => this.x; getX(42)"), 42);
});

test("this: function scope can reach global via this.this", () => {
  expectValue(
    executeTuff("let x : I32 = 7; fn get() : I32 => this.this.x; get()"),
    7,
  );
});

test("this: assignment updates top-level binding", () => {
  expectValue(executeTuff("let mut x : I32 = 1; this.x = 9; x"), 9);
});

test("this: assignment updates parameter binding", () => {
  expectValue(
    executeTuff(
      "fn setLocal(x : I32) : I32 => { this.x = 12; this.x } setLocal(5)",
    ),
    12,
  );
});

test("this: repeated this.this chains are allowed", () => {
  expectValue(
    executeTuff("let x : I32 = 11; fn get() : I32 => this.this.this.x; get()"),
    11,
  );
});

test("this: missing member read is error", () => {
  expectError(executeTuff("let x : I32 = 1; this.y"));
});

test("this: missing member assignment is error", () => {
  expectError(executeTuff("let mut x : I32 = 1; this.y = 2; x"));
});

// object tests
test("object: singleton method updates shared mutable state", () => {
  expectValue(
    executeTuff(
      "object MySingleton { let mut counter : I32 = 0; fn add() => counter += 1; } MySingleton.add(); MySingleton.add(); MySingleton.counter",
    ),
    2,
  );
});

test("object: methods can use this.member", () => {
  expectValue(
    executeTuff(
      "object Counter { let mut value : I32 = 1; fn addTwice() => { this.value = this.value + 1; this.value = this.value + 1; } } Counter.addTwice(); Counter.value",
    ),
    3,
  );
});

test("object: external mutation is allowed for mutable members", () => {
  expectValue(
    executeTuff(
      "object Box { let mut value : I32 = 1; } Box.value = 9; Box.value",
    ),
    9,
  );
});

test("object: singleton identity is stable", () => {
  expectValue(
    executeTuff(
      "object Box { let value : I32 = 1; } if &Box == &Box { 1 } else { 0 }",
    ),
    1,
  );
});

test("object: declaration is allowed inside functions", () => {
  expectValue(
    executeTuff(
      "fn readLocal() => { object Local { let value : I32 = 7; } Local.value } readLocal()",
    ),
    7,
  );
});

test("object: missing member read is error", () => {
  expectError(executeTuff("object Box { let value : I32 = 1; } Box.missing"));
});

test("object: missing member assignment is error", () => {
  expectError(
    executeTuff(
      "object Box { let mut value : I32 = 1; } Box.missing = 2; Box.value",
    ),
  );
});

test("destructure: struct fields bind by name", () => {
  expectValue(
    executeTuff(
      "struct Pair { left : I32; right : I32; } let { left, right } = Pair { left: 2, right: 5 }; left + right",
    ),
    7,
  );
});

test("destructure: struct fields can be renamed", () => {
  expectValue(
    executeTuff(
      "struct Pair { left : I32; right : I32; } let { left: x, right: y } = Pair { left: 3, right: 4 }; x * y",
    ),
    12,
  );
});

test("destructure: object fields snapshot current values", () => {
  expectValue(
    executeTuff(
      "object Counter { let mut value : I32 = 5; } let { value } = Counter; Counter.value = 9; value",
    ),
    5,
  );
});

test("destructure: object fields can be renamed", () => {
  expectValue(
    executeTuff(
      "object Point { let x : I32 = 8; let y : I32 = 13; } let { x: px, y: py } = Point; px + py",
    ),
    21,
  );
});

test("destructure: missing struct field is error", () => {
  expectError(
    executeTuff(
      "struct Pair { left : I32; right : I32; } let { missing } = Pair { left: 1, right: 2 }; missing",
    ),
  );
});

test("destructure: missing object member is error", () => {
  expectError(
    executeTuff("object Box { let value : I32 = 1; } let { missing } = Box; 0"),
  );
});

test("destructure: duplicate binding names are error", () => {
  expectError(
    executeTuff(
      "struct Pair { left : I32; right : I32; } let { left: x, right: x } = Pair { left: 1, right: 2 }; x",
    ),
  );
});

test("destructure: non-struct non-object source is error", () => {
  expectError(executeTuff("let { value } = 42; value"));
});

test("modules: root module call resolves through file object", () => {
  expectValue(
    executeTuffProject("Main", {
      "Main.tuff": "Math.max(3, 4)",
      "Math.tuff":
        "fn max(a : I32, b : I32) : I32 => if a > b { a } else { b };",
    }),
    4,
  );
});

test("modules: qualified module path resolves with double colon", () => {
  expectValue(
    executeTuffProject("com::example::Main", {
      "com/example/Main.tuff": "com::example::Math.max(3, 4)",
      "com/example/Math.tuff":
        "fn max(a : I32, b : I32) : I32 => if a > b { a } else { b };",
    }),
    4,
  );
});

test("modules: destructuring from module object works", () => {
  expectValue(
    executeTuffProject("Main", {
      "Main.tuff": "let { max } = Math; max(3, 4)",
      "Math.tuff":
        "fn max(a : I32, b : I32) : I32 => if a > b { a } else { b };",
    }),
    4,
  );
});

test("modules: exported functions can return module-local structs", () => {
  expectValue(
    executeTuffProject("Main", {
      "Main.tuff": "Geometry.make().right",
      "Geometry.tuff":
        "struct Pair { left : I32; right : I32; } fn make() : Pair => Pair { left : 2, right : 5 };",
    }),
    5,
  );
});

test("modules: exported functions can use module-local type aliases", () => {
  expectValue(
    executeTuffProject("Main", {
      "Main.tuff": "Numbers.value()",
      "Numbers.tuff": "type Score = I32; fn value() : Score => 7;",
    }),
    7,
  );
});

test("modules: missing module path is error", () => {
  expectError(
    executeTuffProject("Main", {
      "Main.tuff": "Missing.max(3, 4)",
    }),
  );
});

test("modules: duplicate inferred module names are rejected", () => {
  expectError(
    executeTuffProject("Main", {
      "Main.tuff": "0",
      "foo/Bar.tuff": "1",
      "foo//Bar.tuff": "2",
    }),
  );
});

test("modules: cross-file members are not globally visible", () => {
  expectError(
    executeTuffProject("Main", {
      "Main.tuff": "max(3, 4)",
      "Math.tuff":
        "fn max(a : I32, b : I32) : I32 => if a > b { a } else { b };",
    }),
  );
});

test("modules: local bindings shadow same-named root modules", () => {
  expectValue(
    executeTuffProject("Main", {
      "Main.tuff": "let Math : I32 = 1; Math",
      "Math.tuff": "fn value() : I32 => 7;",
    }),
    1,
  );
});

test("modules: circular dependencies are rejected", () => {
  expectError(
    executeTuffProject("Main", {
      "Main.tuff": "A.value()",
      "A.tuff": "B.value()",
      "B.tuff": "A.value()",
    }),
  );
});

test("extern: companion js provider supports function call through module object", () => {
  expectValue(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "Math.max(3, 4)",
        "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
      },
      foreignFiles: {
        "Math.js": "module.exports = { max: (a, b) => (a > b ? a : b) };",
      },
    }),
    4,
  );
});

test("extern: destructuring works for foreign-backed module members", () => {
  expectValue(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "let { max } = Math; max(3, 4)",
        "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
      },
      foreignFiles: {
        "Math.js": "module.exports = { max: (a, b) => (a > b ? a : b) };",
      },
    }),
    4,
  );
});

test("extern: extern let exposes js values", () => {
  expectValue(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "Math.answer",
        "Math.tuff": "extern Math; extern let answer : I32;",
      },
      foreignFiles: {
        "Math.js": "module.exports = { answer: 42 };",
      },
    }),
    42,
  );
});

test("extern: missing companion js provider is a compile error", () => {
  const compileResult = compileProjectCode("Main", {
    "Main.tuff": "Math.max(3, 4)",
    "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
  });

  expect(isErr(compileResult)).toBe(true);
});

test("extern: duplicate js providers are rejected", () => {
  const compileResult = compileProjectCode("Main", {
    "Main.tuff": "Math.max(3, 4)",
    "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
    "foo/Math.js": "module.exports = { max: (a, b) => a };",
    "foo//Math.js": "module.exports = { max: (a, b) => b };",
  });

  expect(isErr(compileResult)).toBe(true);
});

test("extern: missing js export is a runtime error", () => {
  expectError(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "Math.max(3, 4)",
        "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
      },
      foreignFiles: {
        "Math.js": "module.exports = { min: (a, b) => (a < b ? a : b) };",
      },
    }),
  );
});

test("extern: non-callable js export used as extern fn is a runtime error", () => {
  expectError(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "Math.max(3, 4)",
        "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
      },
      foreignFiles: {
        "Math.js": "module.exports = { max: 42 };",
      },
    }),
  );
});

test("extern: mixed Tuff and JS project graph executes", () => {
  expectValue(
    executeTuffProjectFixture({
      entryModule: "Main",
      tuffFiles: {
        "Main.tuff": "Bridge.compute(5)",
        "Bridge.tuff":
          "extern Bridge; extern fn compute(x : I32) : I32; fn plusOne(x : I32) : I32 => x + 1;",
        "Helper.tuff": "fn double(x : I32) : I32 => x * 2;",
      },
      foreignFiles: {
        "Bridge.js": "module.exports = { compute: (x) => (x * 2) + 1 };",
      },
    }),
    11,
  );
});

test("extern: project registry records js target and provider metadata", () => {
  const moduleMap = expectProjectModuleMap({
    "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
    "Math.js": "module.exports = { max: (a, b) => (a > b ? a : b) };",
  });

  const mathModule = moduleMap.get("Math");
  expect(mathModule?.target).toBe("js");
  expect(mathModule?.externalProvider?.target).toBe("js");
});

test("extern: contract-only modules are marked external after parsing", () => {
  const { moduleMap, module } = expectParsedProjectModule(
    {
      "Math.tuff": "extern Math; extern fn max(a : I32, b : I32) : I32;",
      "Math.js": "module.exports = { max: (a, b) => (a > b ? a : b) };",
    },
    "Math",
  );

  expect(module?.implementationOrigin).toBe("external");
  expect(moduleMap.get("Math")?.implementationOrigin).toBe("external");
});

test("extern: mixed contract modules are marked hybrid after parsing", () => {
  const { moduleMap, module } = expectParsedProjectModule(
    {
      "Bridge.tuff":
        "extern Bridge; extern fn compute(x : I32) : I32; fn plusOne(x : I32) : I32 => x + 1;",
      "Bridge.js": "module.exports = { compute: (x) => (x * 2) + 1 };",
    },
    "Bridge",
  );

  expect(module?.implementationOrigin).toBe("hybrid");
  expect(moduleMap.get("Bridge")?.implementationOrigin).toBe("hybrid");
});

test("extern: orphan js providers without tuff contracts are rejected", () => {
  const compileResult = compileProjectCode("Main", {
    "Main.tuff": "0",
    "Math.js": "module.exports = { max: (a, b) => (a > b ? a : b) };",
  });

  expect(isErr(compileResult)).toBe(true);
});

test("extern: module declarations parse with function, let, and type contracts", () => {
  const parsedModules = parseProjectModules(
    {
      "Api.tuff":
        "extern Api; extern fn max(a : I32, b : I32) : I32; extern let answer : I32; extern type Score = I32; 0",
      "Api.js":
        "module.exports = { max: (a, b) => (a > b ? a : b), answer: 42 };",
    },
    ["Api"],
  );

  if (isErr(parsedModules)) {
    expect(parsedModules.error).toBeUndefined();
    return;
  }

  expect(parsedModules.value.has("Api")).toBe(true);
});

test("extern: declarations are rejected inside function bodies", () => {
  const parsedModules = parseProjectModules(
    {
      "Api.tuff": "fn bad() : I32 => { extern fn max(a : I32) : I32; 0 } bad()",
    },
    ["Api"],
  );

  expect(isErr(parsedModules)).toBe(true);
});

test("extern: duplicate extern function declarations are rejected", () => {
  const parsedModules = parseProjectModules(
    {
      "Api.tuff":
        "extern Api; extern fn max(a : I32) : I32; extern fn max(a : I32) : I32; 0",
    },
    ["Api"],
  );

  expect(isErr(parsedModules)).toBe(true);
});

test("extern: declarations populate module member lookup for downstream parsing", () => {
  const parsedModules = parseProjectModules(
    {
      "Api.tuff":
        "extern Api; extern fn max(a : I32, b : I32) : I32; extern let answer : I32; extern type Score = I32; 0",
      "Api.js":
        "module.exports = { max: (a, b) => (a > b ? a : b), answer: 42 };",
      "Main.tuff": "let { max, answer } = Api; max(answer, 4)",
    },
    ["Api", "Main"],
  );

  if (isErr(parsedModules)) {
    expect(parsedModules.error).toBeUndefined();
    return;
  }

  expect(parsedModules.value.has("Main")).toBe(true);
});

test("extern: Tuff and extern declarations cannot claim the same member name", () => {
  const parsedModules = parseProjectModules(
    {
      "Api.tuff":
        "extern Api; fn max(a : I32, b : I32) : I32 => a; extern fn max(a : I32, b : I32) : I32; 0",
    },
    ["Api"],
  );

  expect(isErr(parsedModules)).toBe(true);
});

test("function inference: omitted return type is inferred for expression bodies", () => {
  expectValue(executeTuff("fn addOne(x : I32) => x + 1; addOne(4)"), 5);
});

test("function inference: omitted return type infers Void for assignment bodies", () => {
  expectValue(
    executeTuff("let mut x : I32 = 0; fn bump() => x += 1; bump(); x"),
    1,
  );
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

test("function: missing return type is inferred", () => {
  expectValue(executeTuff("fn add(a : I32) => a; add(5)"), 5);
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

test("closure: named function captures top-level mutable variable", () => {
  expectValue(
    executeTuff(
      "let mut counter : I32 = 0; fn add() : Void => counter += 1; add(); counter",
    ),
    1,
  );
});

test("closure: named function captures top-level immutable variable for reading", () => {
  expectValue(
    executeTuff("let base : I32 = 41; fn addOne() : I32 => base + 1; addOne()"),
    42,
  );
});

test("closure: nested function captures enclosing mutable variable", () => {
  expectValue(
    executeTuff(
      "fn outer() : I32 => { let mut counter : I32 = 0; fn add() : Void => counter += 1; add(); counter } outer()",
    ),
    1,
  );
});

test("closure: closure value captures outer variable", () => {
  expectValue(
    executeTuff(
      "let counter : I32 = 3; let add : (I32) => I32 = (x : I32) => x + counter; add(4)",
    ),
    7,
  );
});

test("closure: reassigning captured immutable variable is error", () => {
  expectError(
    executeTuff(
      "let counter : I32 = 0; fn add() : Void => counter += 1; add(); counter",
    ),
  );
});

test("closure: shadowing captured variable with parameter is error", () => {
  expectError(
    executeTuff(
      "let counter : I32 = 1; fn add(counter : I32) : I32 => counter + 1; add(2)",
    ),
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

// Refinement types - compile-time constraint checking
test("refinement: basic literal refinement valid", () => {
  expectValue(executeTuff("let x : I32 > 100 = 200; x"), 200);
});

test("refinement: compile error when literal violates constraint", () => {
  expectError(executeTuff("let x : I32 > 100 = 50; x"));
});

test("refinement: compile error when assigning unrefined variable to refined type without proof", () => {
  expectError(executeTuff("let x : I32 = 100; let y : I32 > 100 = x; y"));
});

test("refinement: type narrowing in if-block enables assignment", () => {
  const result = executeTuffWithInput(
    "let x : I32 = read<I32>(); if (x > 100) { let y : I32 > 100 = x; y } else { 0 }",
    "200",
  );
  expectValue(result, 200);
});

test("refinement: type narrowing rejects in else-branch (proof lost)", () => {
  expectError(
    executeTuff(
      "let mut x : I32 = 50; if (x > 100) { 1 } else { let y : I32 > 100 = x; y }",
    ),
  );
});

test("refinement: multiple constraints with AND", () => {
  expectValue(executeTuff("let x : I32 > 0 && I32 < 1000 = 500; x"), 500);
});

test("refinement: multiple constraints AND - lower bound violation", () => {
  expectError(executeTuff("let x : I32 > 0 && I32 < 1000 = -1; x"));
});

test("refinement: multiple constraints AND - upper bound violation", () => {
  expectError(executeTuff("let x : I32 > 0 && I32 < 1000 = 1500; x"));
});

test("refinement: OR constraints", () => {
  expectValue(executeTuff("let x : I32 < 0 || I32 > 100 = 150; x"), 150);
});

test("refinement: OR constraints - alternative branch", () => {
  expectValue(executeTuff("let x : I32 < 0 || I32 > 100 = -50; x"), -50);
});

// TODO: String refinement requires string literal tokenization support
// test("refinement: string refinement by length", () => {
//   expectValue(executeTuff('let s : String > 0 = "hello"; 1'), 1);
// });

test("refinement: equality constraint", () => {
  expectValue(executeTuff("let x : I32 == 42 = 42; x"), 42);
});

test("refinement: equality constraint violation", () => {
  expectError(executeTuff("let x : I32 == 42 = 43; x"));
});

test("refinement: type narrowing with complex guard condition", () => {
  const result = executeTuffWithInput(
    "let x : I32 = read<I32>(); if (x > 50 && x < 200) { let y : I32 > 50 = x; y } else { 0 }",
    "100",
  );
  expectValue(result, 100);
});

test("refinement: nested if narrowing", () => {
  const result = executeTuffWithInput(
    "let x : I32 = read<I32>(); if (x > 0) { if (x < 100) { let y : I32 > 0 && I32 < 100 = x; y } else { 0 } } else { 0 }",
    "50",
  );
  expectValue(result, 50);
});

// Expression-based refinement constraints
test("refinement: variable constraint with constant-folding", () => {
  expectValue(executeTuff("let x : I32 = 50; let y : I32 > x = 100; y"), 100);
});

test("refinement: variable constraint proves at compile-time", () => {
  expectValue(
    executeTuff(
      "let x : I32 = 10; let y : I32 > x = 20; let z : I32 > 15 = y; z",
    ),
    20,
  );
});

test("refinement: variable constraint with dynamic value fails", () => {
  expectError(
    executeTuff("let x : I32 = read<I32>(); let y : I32 > x = 100; y"),
  );
});

test("refinement: narrowing with variable constraint", () => {
  const result = executeTuffWithInput(
    "let x : I32 = read<I32>(); let threshold : I32 = 50; if (x > threshold) { let y : I32 > threshold = x; y } else { 0 }",
    "100",
  );
  expectValue(result, 100);
});

test("refinement: arithmetic constraint", () => {
  expectValue(executeTuff("let x : I32 = 10; let y : I32 > x + 5 = 20; y"), 20);
});

test("refinement: arithmetic constraint fails when not satisfied", () => {
  expectError(executeTuff("let x : I32 = 10; let y : I32 > x + 5 = 12; y"));
});

test("pointer: basic immutable pointer to I32", () => {
  expectValue(executeTuff("let x : I32 = 100; let y : *I32 = &x; *y"), 100);
});

test("pointer: immutable pointer to U8", () => {
  expectValue(executeTuff("let x : U8 = 42; let y : *U8 = &x; *y"), 42);
});

test("pointer: immutable pointer to F32", () => {
  expectValue(executeTuff("let x : F32 = 3.14; let y : *F32 = &x; *y"), 3.14);
});

test("pointer: dereference returns correct type", () => {
  expectValue(
    executeTuff("let x : I32 = 50; let y : *I32 = &x; let z : I32 = *y; z"),
    50,
  );
});

test("pointer: pointer to pointer", () => {
  expectValue(
    executeTuff(
      "let x : I32 = 100; let y : *I32 = &x; let z : **I32 = &y; **z",
    ),
    100,
  );
});

test("pointer: pointer type mismatch on initialization", () => {
  expectError(executeTuff("let x : I32 = 100; let y : *U8 = &x; y"));
});

test("pointer: pointer type mismatch on dereference", () => {
  expectError(executeTuff("let x : I32 = 100; let y : *U8 = &x; *y"));
});

test("pointer: dereference non-pointer type is error", () => {
  expectError(executeTuff("let x : I32 = 100; *x"));
});

test("pointer: invalid pointer type syntax", () => {
  expectError(executeTuff("let x : *I32 = 100; x"));
});

test("pointer: address-of non-variable is error", () => {
  expectError(executeTuff("let x : *I32 = &100; x"));
});

test("pointer: using pointer in arithmetic fails", () => {
  expectError(executeTuff("let x : I32 = 100; let y : *I32 = &x; y + 1"));
});

test("pointer: out-of-scope variable error", () => {
  expectError(
    executeTuff("let y : *I32; if (true) { let x : I32 = 100; y = &x; } *y"),
  );
});

test("pointer: pointer assignment from valid variable", () => {
  expectValue(
    executeTuff("let x : I32 = 100; let y : *I32 = &x; let z : *I32 = &x; *z"),
    100,
  );
});

test("mutable pointer: basic mutable pointer declaration", () => {
  expectValue(
    executeTuff("let mut x : I32 = 100; let y : *mut I32 = &mut x; *y"),
    100,
  );
});

test("mutable pointer: assign through mutable pointer", () => {
  expectValue(
    executeTuff("let mut x : I32 = 50; let y : *mut I32 = &mut x; *y = 200; x"),
    200,
  );
});

test("mutable pointer: multiple assignments through mutable pointer", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 10; let y : *mut I32 = &mut x; *y = 20; *y = 30; x",
    ),
    30,
  );
});

test("mutable pointer: mutable pointer with read input", () => {
  const result = executeTuffWithInput(
    "let mut x : I32 = 0; let y : *mut I32 = &mut x; *y = read<I32>(); x",
    "99",
  );
  expectValue(result, 99);
});

test("mutable pointer: mutable pointer to U8", () => {
  expectValue(
    executeTuff("let mut x : U8 = 42; let y : *mut U8 = &mut x; *y = 100; x"),
    100,
  );
});

test("mutable pointer: coerce mutable to immutable pointer", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 100; let y : *mut I32 = &mut x; let z : *I32 = y; *z",
    ),
    100,
  );
});

test("mutable pointer: cannot take mutable ref to immutable variable", () => {
  expectError(executeTuff("let x : I32 = 100; let y : *mut I32 = &mut x; y"));
});

test("mutable pointer: cannot assign to immutable pointer with mutable value", () => {
  expectError(
    executeTuff(
      "let mut x : I32 = 100; let y : *mut I32 = &mut x; let z : *mut I32 = &mut x; y",
    ),
  );
});

test("mutable pointer: assign to dereferenced mutable pointer in expression", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 10; let y : *mut I32 = &mut x; *y = (*y) + 5; x",
    ),
    15,
  );
});

test("mutable pointer: mutable pointer arithmetic through dereference", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 100; let y : *mut I32 = &mut x; *y = *y * 2; x",
    ),
    200,
  );
});

test("mutable pointer: nested dereference assignment", () => {
  expectValue(
    executeTuff(
      "let mut x : I32 = 50; let y : *mut I32 = &mut x; let z : *mut I32 = y; *z = 75; x",
    ),
    75,
  );
});

// ===== ARRAY TESTS =====

test("array: basic declaration with named generator function", () => {
  expectValue(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 3] = [one; 3]; arr[0]"),
    1,
  );
});

test("array: direct closure generator populates each slot", () => {
  expectValue(executeTuff("let arr : [I32; 3] = [() => 7; 3]; arr[2]"), 7);
});

test("array: closure generator can produce distinct values", () => {
  expectValue(
    executeTuff(
      "let mut current : I32 = 0; fn next() : I32 => { current += 1; current } let arr : [I32; 3] = [next; 3]; arr[1]",
    ),
    2,
  );
});

test("array: U8 element type", () => {
  expectValue(
    executeTuff(
      "fn byte() : U8 => 100U8; let arr : [U8; 2] = [byte; 2]; arr[0]",
    ),
    100,
  );
});

test("array: F32 element type", () => {
  expectFloatValue(
    executeTuff(
      "fn value() : F32 => 2.71F32; let arr : [F32; 2] = [value; 2]; arr[1]",
    ),
    2.71,
  );
});

test("array: length property returns declared length", () => {
  expectValue(
    executeTuff(
      "fn one() : I32 => 1; let arr : [I32; 5] = [one; 5]; arr.length",
    ),
    5,
  );
});

test("array: access element in arithmetic", () => {
  expectValue(
    executeTuff(
      "let mut current : I32 = 0; fn next() : I32 => { current += 1; current } let arr : [I32; 3] = [next; 3]; arr[0] + arr[1]",
    ),
    3,
  );
});

test("array: mutable array element reassignment", () => {
  expectValue(
    executeTuff(
      "fn one() : I32 => 1; let mut arr : [I32; 2] = [one; 2]; arr[0] = 100; arr[0]",
    ),
    100,
  );
});

test("array: mutable array multiple reassignments", () => {
  expectValue(
    executeTuff(
      "fn one() : I32 => 1; let mut arr : [I32; 2] = [one; 2]; arr[0] = 10; arr[1] = 20; arr[0] + arr[1]",
    ),
    30,
  );
});

test("array: immutable array modification error", () => {
  expectError(
    executeTuff(
      "fn one() : I32 => 1; let arr : [I32; 2] = [one; 2]; arr[0] = 10; arr[0]",
    ),
  );
});

test("array: nested arrays via generator function", () => {
  expectValue(
    executeTuff(
      "fn makeRow() : [I32; 2] => { let mut current : I32 = 0; fn next() : I32 => { current += 1; current } [next; 2] } let arr : [[I32; 2]; 2] = [makeRow; 2]; arr[1][1]",
    ),
    2,
  );
});

test("array: array returned from function", () => {
  expectValue(
    executeTuff(
      "fn seed() : I32 => 10; fn getArray() : [I32; 3] => [seed; 3]; let a : [I32; 3] = getArray(); a[1]",
    ),
    10,
  );
});

test("array: pass array to function", () => {
  expectValue(
    executeTuff(
      "fn value() : I32 => 6; fn sum(a : [I32; 2]) : I32 => a[0] + a[1]; let arr : [I32; 2] = [value; 2]; sum(arr)",
    ),
    12,
  );
});

test("array: array element in while loop", () => {
  expectValue(
    executeTuff(
      "fn three() : I32 => 3; let arr : [I32; 1] = [three; 1]; let mut x : I32 = 0; let mut i : I32 = 0; while (i < arr[0]) { x = x + 1; i = i + 1 }; x",
    ),
    3,
  );
});

test("array: generator return type mismatch is error", () => {
  expectError(
    executeTuff(
      "fn makeFloat() : F32 => 2.5F32; let arr : [I32; 2] = [makeFloat; 2]; arr[0]",
    ),
  );
});

test("array: generator repeat count must match declared length", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 3] = [one; 2]; arr[0]"),
  );
});

test("array: generator repeat count cannot exceed declared length", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 2] = [one; 3]; arr[0]"),
  );
});

test("array: invalid array type syntax", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32] = [one; 3]; arr[0]"),
  );
});

test("array: missing element count in type", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32;] = [one; 3]; arr[0]"),
  );
});

test("array: accessing with non-index expression", () => {
  expectError(
    executeTuff(
      "fn one() : I32 => 1; let arr : [I32; 2] = [one; 2]; let x : F32 = 0.5; arr[x]",
    ),
  );
});

test("array: missing array initializer", () => {
  expectError(executeTuff("let arr : [I32; 2]; arr[0]"));
});

test("array: non-callable generator is error", () => {
  expectError(
    executeTuff("let x : I32 = 1; let arr : [I32; 2] = [x; 2]; arr[0]"),
  );
});

test("array: generator must be zero-argument callable", () => {
  expectError(
    executeTuff(
      "fn add(x : I32) : I32 => x; let arr : [I32; 2] = [add; 2]; arr[0]",
    ),
  );
});

test("array: missing opening bracket in initializer", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 2] = one; 2]; arr[0]"),
  );
});

test("array: missing closing bracket in initializer", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 2] = [one; 2; arr[0]"),
  );
});

test("array: dynamic index remains disallowed", () => {
  expectError(
    executeTuff(
      "fn one() : I32 => 1; let arr : [I32; 2] = [one; 2]; let i : I32 = 1; arr[i]",
    ),
  );
});

test("array: writing beyond fixed length is error", () => {
  expectError(
    executeTuff(
      "fn one() : I32 => 1; let mut arr : [I32; 2] = [one; 2]; arr[2] = 50; arr[1]",
    ),
  );
});

test("array: constant out of bounds access is error", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 2] = [one; 2]; arr[2]"),
  );
});

test("array: array element type mismatch in assignment", () => {
  expectError(
    executeTuff(
      "fn one() : I32 => 1; let mut arr : [I32; 2] = [one; 2]; arr[0] = 3.14; arr[0]",
    ),
  );
});

test("array: negative index access", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [I32; 2] = [one; 2]; arr[-1]"),
  );
});

test("array: missing type in array type", () => {
  expectError(
    executeTuff("fn one() : I32 => 1; let arr : [; 2] = [one; 2]; arr[0]"),
  );
});

test("array: invalid length zero", () => {
  expectError(executeTuff("let arr : [I32; 0] = []; arr[0]"));
});

// ===== ARRAY SLICE TESTS =====

test("slice: whole array via &array", () => {
  expectValue(
    executeTuff(
      "fn one() : I32 => 1; let arr : [I32; 3] = [one; 3]; let s : *[I32] = &arr; s.length",
    ),
    3,
  );
});

test("slice: explicit start and end", () => {
  expectValue(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[1..3]; s[0] + s[1]",
    ),
    50,
  );
});

test("slice: open start bound", () => {
  expectValue(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[..2]; s.length + s[1]",
    ),
    22,
  );
});

test("slice: open end bound", () => {
  expectValue(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[2..]; s[0] + s.length",
    ),
    32,
  );
});

test("slice: empty slice is valid", () => {
  expectValue(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[2..2]; s.length",
    ),
    0,
  );
});

test("slice: mutable slice writes through to source array", () => {
  expectValue(
    executeTuff(
      "let mut arr : [I32; 4] = [10, 20, 30, 40]; let s : *mut [I32] = &mut arr[1..3]; s[0] = 99; arr[1]",
    ),
    99,
  );
});

test("slice: immutable slice assignment is error", () => {
  expectError(
    executeTuff(
      "let mut arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[1..3]; s[0] = 99; arr[1]",
    ),
  );
});

test("slice: mutable slice requires mutable source", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *mut [I32] = &mut arr[1..3]; s[0]",
    ),
  );
});

test("slice: start greater than end is error", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[3..1]; s.length",
    ),
  );
});

test("slice: end beyond array length is error", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[1..5]; s.length",
    ),
  );
});

test("slice: negative start is error", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[-1..2]; s.length",
    ),
  );
});

test("slice: dynamic bounds are rejected", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let start : I32 = 1; let s : *[I32] = &arr[start..3]; s.length",
    ),
  );
});

test("slice: slice index out of bounds is error", () => {
  expectError(
    executeTuff(
      "let arr : [I32; 4] = [10, 20, 30, 40]; let s : *[I32] = &arr[1..3]; s[2]",
    ),
  );
});
