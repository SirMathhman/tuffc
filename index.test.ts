import { compileTuffToTS, type CompileError, type Result } from ".";

const transpiler = new Bun.Transpiler({ loader: "ts" });

async function executeTuff(
  tuffSource: string,
  stdin = "",
  allowLintErrors = true,
): Promise<Result<number, CompileError>> {
  // Step 0: Compile Tuff code to TypeScript
  const compileResult = compileTuffToTS(tuffSource);
  if (compileResult.type === "err") {
    /*
    This ensures that when we expect an error, it actually occurs during compile-time
    and not during transpilation or execution.
    */
    return {
      type: "err",
      error: compileResult.error,
    };
  }

  if (!allowLintErrors) {
    const { default: eslintConfig } = await import("./eslint.config.js");
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({
      overrideConfig:
        eslintConfig as unknown as import("eslint").Linter.Config[],
      overrideConfigFile: true,
    });

    const results = await eslint.lintText(compileResult.value, {
      filePath: "virtual.ts", // needs a .ts extension so the parser kicks in
    });

    const unexpectedMessages = results.flatMap((result) =>
      result.messages.filter(
        (message) => message.ruleId !== "@typescript-eslint/no-unused-vars",
      ),
    );
    expect(unexpectedMessages).toHaveLength(0);
  }

  // Step 2: Compile TypeScript code to JavaScript using Bun's transpiler
  const tsSource = compileResult.value;
  let jsSource: string;
  try {
    jsSource = transpiler.transformSync(tsSource);
  } catch (transpileError) {
    // This will fail the test if transpilation throws an error
    expect(transpileError).toBeUndefined();

    // Nothing is actually returned
    return {
      type: "ok",
      value: 0,
    };
  }

  // Step 3: Execute the JavaScript code using new Function and capture the result
  try {
    const readSetup = `
      const __stdin = ${JSON.stringify(stdin)};
      const __readQueue = __stdin.trim() ? __stdin.trim().split(/\\s+/) : [];
      let __readIndex = 0;

      function read(type) {
        const val = __readQueue[__readIndex++];
        return Number(val);
      }
    `;

    const result = new Function(readSetup + jsSource)();
    return {
      type: "ok",
      value: result,
    };
  } catch (executionError) {
    expect(executionError).toBeUndefined();
    return {
      type: "ok",
      value: 0,
    };
  }
}

function expectCompileError(
  result: Result<number, CompileError>,
  expected: { message: string; reason: string; fix: string },
): void {
  expect(result).toMatchObject({ type: "err" });

  if (result.type !== "err") {
    return;
  }

  expect(result.error.message).toBe(expected.message);
  expect(result.error.message).not.toBe("Compilation failed");
  expect(result.error.reason).toContain(expected.reason);
  expect(result.error.fix).toContain(expected.fix);
  expect(result.error.reason.length).toBeGreaterThan(20);
  expect(result.error.fix.length).toBeGreaterThan(10);
}

async function expectRangeFailure(tuffSource: string): Promise<void> {
  const result = await executeTuff(tuffSource);
  expectCompileError(result, {
    message: "Integer literal is out of range.",
    reason: "does not fit in U8",
    fix: "Use a value between 0 and 255",
  });
}

describe("The Tuff Compiler", () => {
  it("should compile and execute an empty program", async () => {
    const tuffSource = "";
    const result = await executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 0 });
  });

  it("should compile and execute a literal number", async () => {
    const tuffSource = "100";
    const result = await executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should compile and execute a U8 literal number", async () => {
    const tuffSource = "100U8";
    const result = await executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should fail to compile a negative U8 literal", async () => {
    await expectRangeFailure("-100U8");
  });

  it("should fail to compile U8 value out of range", async () => {
    await expectRangeFailure("256U8");
  });

  it("should compile and execute U16/U32/U64 values", async () => {
    expect(await executeTuff("65535U16")).toMatchObject({
      type: "ok",
      value: 65535,
    });
    expect(await executeTuff("4294967295U32")).toMatchObject({
      type: "ok",
      value: 4294967295,
    });
    expect(await executeTuff("9223372036854775807U64")).toMatchObject({
      type: "ok",
      value: 9223372036854775807,
    });
  });

  it("should compile and execute signed I8/I16/I32/I64 values", async () => {
    expect(await executeTuff("-128I8")).toMatchObject({
      type: "ok",
      value: -128,
    });
    expect(await executeTuff("127I8")).toMatchObject({
      type: "ok",
      value: 127,
    });
    expect(await executeTuff("-32768I16")).toMatchObject({
      type: "ok",
      value: -32768,
    });
    expect(await executeTuff("32767I16")).toMatchObject({
      type: "ok",
      value: 32767,
    });
    expect(await executeTuff("-2147483648I32")).toMatchObject({
      type: "ok",
      value: -2147483648,
    });
    expect(await executeTuff("2147483647I32")).toMatchObject({
      type: "ok",
      value: 2147483647,
    });
    expect(await executeTuff("-9223372036854775808I64")).toMatchObject({
      type: "ok",
      value: -9223372036854775808,
    });
    expect(await executeTuff("9223372036854775807I64")).toMatchObject({
      type: "ok",
      value: 9223372036854775807,
    });
  });

  it("should compile and execute addition of U8 literals", async () => {
    const result = await executeTuff("1U8 + 2U8");
    expect(result).toMatchObject({ type: "ok", value: 3 });
  });

  it("should fail to compile addition overflow for U8 literals", async () => {
    const result = await executeTuff("1U8 + 255U8");
    expectCompileError(result, {
      message: "Integer literal is out of range.",
      reason: "does not fit in U8",
      fix: "Use a value between 0 and 255",
    });
  });

  it("should compile and execute mixed-suffix addition", async () => {
    const compileResult = compileTuffToTS("1U8 + 255U16");
    console.log("compileResult", compileResult);
    const result = await executeTuff("1U8 + 255U16");
    expect(result).toMatchObject({ type: "ok", value: 256 });
  });

  it("should compile and execute mixed-typed-and-untagged addition", async () => {
    const result = await executeTuff("1U8 + 255 + 1U16");
    expect(result).toMatchObject({ type: "ok", value: 257 });
  });

  it("should compile and execute 3-term U8 addition", async () => {
    const result = await executeTuff("1U8 + 2U8 + 3U8");
    expect(result).toMatchObject({ type: "ok", value: 6 });
  });

  it("should compile and execute multiplication plus addition", async () => {
    const result = await executeTuff("10 * 5 + 3");
    expect(result).toMatchObject({ type: "ok", value: 53 });
  });

  it("should compile and execute addition with multiplication precedence", async () => {
    const result = await executeTuff("10 + 5 * 3");
    expect(result).toMatchObject({ type: "ok", value: 25 });
  });

  it("should compile and execute division", async () => {
    const result = await executeTuff("10 / 2");
    expect(result).toMatchObject({ type: "ok", value: 5 });
  });

  it("should compile and execute read/U8 stdin input", async () => {
    const result = await executeTuff("read<U8>() + read<U8>()", "25 75");
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should compile and execute let x=read<U8>() and reuse value", async () => {
    const result = await executeTuff("let x = read<U8>(); x + x", "25 75");
    expect(result).toMatchObject({ type: "ok", value: 50 });
  });

  it("should compile and execute mutable reassignment", async () => {
    const result = await executeTuff(
      "let mut x = read<U8>(); x = read<U8>(); x",
      "1 2",
    );
    expect(result).toMatchObject({ type: "ok", value: 2 });
  });

  it("should fail on immutable reassignment", async () => {
    const result = await executeTuff(
      "let x = read<U8>(); x = read<U8>(); x",
      "1 2",
    );
    expectCompileError(result, {
      message: "Cannot assign to immutable variable.",
      reason: "was declared without mut",
      fix: "Change the declaration to let mut x = ...",
    });
  });

  it("should fail on assignment to undeclared variable", async () => {
    const result = await executeTuff("x = read<U8>(); x", "1 2");
    expectCompileError(result, {
      message: "Use of undeclared variable.",
      reason: "used before it is declared",
      fix: "Declare x with let before using it",
    });
  });

  it("should fail on address-of undeclared variable", async () => {
    const result = await executeTuff("let y : *I32 = &x; *y");
    expectCompileError(result, {
      message: "Use of undeclared variable.",
      reason: "used before it is declared",
      fix: "Declare x with let before using it",
    });
  });

  it("should compile and execute pointer dereference", async () => {
    const result = await executeTuff("let x = 100; let y : *I32 = &x; *y");
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should fail pointer assignment when pointee type mismatches", async () => {
    const result = await executeTuff("let x = 100U16; let y : *I32 = &x; *y");
    expectCompileError(result, {
      message: "Assignment type mismatch.",
      reason: "type *U16, which is not assignable to *I32",
      fix: "Change the expression type to *I32",
    });
  });

  it("should fail dereference of non-pointer variable", async () => {
    const result = await executeTuff("let x = 100; *x");
    expectCompileError(result, {
      message: "Dereference requires a pointer.",
      reason: "type is I32, not a pointer type",
      fix: "Take the address of a variable first",
    });
  });

  it("should compile and execute mutable pointer write through and read back", async () => {
    const result = await executeTuff(
      "let mut x = read<U8>(); let y : *mut U8 = &mut x; *y = read<U8>(); x",
      "1 2",
    );
    expect(result).toMatchObject({ type: "ok", value: 2 });
  });

  it("should fail mutable reference to immutable variable", async () => {
    const result = await executeTuff(
      "let x = read<U8>(); let y : *mut U8 = &mut x; *y = read<U8>(); x",
      "1 2",
    );
    expectCompileError(result, {
      message: "Mutable reference requires a mutable variable.",
      reason:
        "Cannot take a mutable reference to x because it was not declared with mut",
      fix: "Declare x as let mut x = ...",
    });
  });

  it("should fail mutable pointer target for immutable reference", async () => {
    const result = await executeTuff(
      "let mut x = read<U8>(); let y : *mut U8 = &x; *y = read<U8>(); x",
      "1 2",
    );
    expectCompileError(result, {
      message: "Assignment type mismatch.",
      reason: "type *U8, which is not assignable to *mutU8",
      fix: "Change the expression type to *mutU8",
    });
  });

  it("should fail mutable pointer type mismatch with immutable pointer", async () => {
    const result = await executeTuff(
      "let mut x = read<U8>(); let y : *U8 = &mut x; *y = read<U8>(); x",
      "1 2",
    );
    expectCompileError(result, {
      message: "Assignment type mismatch.",
      reason: "type *mutU8, which is not assignable to *U8",
      fix: "Change the expression type to *U8",
    });
  });

  it("should compile and execute mut U16 pointer write from U8 and read back", async () => {
    const result = await executeTuff(
      "let mut x = read<U16>(); let y = &mut x; *y = read<U8>(); x",
      "1 2",
    );
    expect(result).toMatchObject({ type: "ok", value: 2 });
  });

  it("should compile and execute modulus", async () => {
    const result = await executeTuff("10 % 3");
    expect(result).toMatchObject({ type: "ok", value: 1 });
  });

  it("should compile and execute parenthesized expression", async () => {
    const result = await executeTuff("(2 + 3) * 5");
    expect(result).toMatchObject({ type: "ok", value: 25 });
  });

  it("should compile and execute let binding expression", async () => {
    const result = await executeTuff("let x : I32 = (2 + 3) * 5; x");
    expect(result).toMatchObject({ type: "ok", value: 25 });
  });

  it("should compile and execute let binding with no final expression", async () => {
    const result = await executeTuff("let x : I32 = (2 + 3) * 5;", "", true);
    expect(result).toMatchObject({ type: "ok", value: 0 });
  });

  it("should compile and execute let binding with inferred type", async () => {
    const result = await executeTuff("let x = (2 + 3) * 5; x");
    expect(result).toMatchObject({ type: "ok", value: 25 });
  });

  it("should fail when assigning oversized typed literal", async () => {
    const result = await executeTuff("let x : U8 = 100U16; x");
    expectCompileError(result, {
      message: "Assignment type mismatch.",
      reason: "type U16, which is not assignable to U8",
      fix: "Change the expression type to U8",
    });
  });

  it("should allow assignment to wider typed variable", async () => {
    const result = await executeTuff("let x : U16 = 100U8; x");
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should fail on duplicate let variable", async () => {
    const result = await executeTuff("let x = 100; let x = 0;");
    expectCompileError(result, {
      message: "Duplicate variable declaration.",
      reason: "x is declared more than once",
      fix: "Rename one of the variables or reuse the existing x binding",
    });
  });

  it("should fail U8 assignment from U16 variable", async () => {
    const result = await executeTuff("let x = 100U16; let y : U8 = x;");
    expectCompileError(result, {
      message: "Assignment type mismatch.",
      reason: "type U16, which is not assignable to U8",
      fix: "Change the expression type to U8",
    });
  });
});
