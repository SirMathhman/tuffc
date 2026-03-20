import { compileTuffToTS, type CompileError, type Result } from ".";

const transpiler = new Bun.Transpiler({ loader: "ts" });

function executeTuff(tuffSource: string): Result<number, CompileError> {
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
    const result = new Function(jsSource)();
    return {
      type: "ok",
      value: result,
    };
  } catch (executionError) {
    // This will fail the test if execution throws an error
    expect(executionError).toBeUndefined();
    return {
      type: "ok",
      value: 0,
    };
  }
}

describe("The Tuff Compiler", () => {
  it("should fail to compile an invalid program", () => {
    const tuffSource = "invalid";
    const result = compileTuffToTS(tuffSource);
    expect(result).toMatchObject({
      type: "err",
      error: {
        invalidSource: tuffSource,
        message: "Compilation failed",
        reason: "Syntax error",
        fix: "Check the syntax of your Tuff code and try again.",
      },
    });
  });

  it("should compile and execute an empty program", () => {
    const tuffSource = "";
    const result = executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 0 });
  });

  it("should compile and execute a literal number", () => {
    const tuffSource = "100";
    const result = executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should compile and execute a U8 literal number", () => {
    const tuffSource = "100U8";
    const result = executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 100 });
  });

  it("should fail to compile a negative U8 literal", () => {
    const tuffSource = "-100U8";
    const result = executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "err" });
  });

  it("should fail to compile U8 value out of range", () => {
    const tuffSource = "256U8";
    const result = executeTuff(tuffSource);
    expect(result).toMatchObject({ type: "err" });
  });

  it("should compile and execute U16/U32/U64 values", () => {
    expect(executeTuff("65535U16")).toMatchObject({ type: "ok", value: 65535 });
    expect(executeTuff("4294967295U32")).toMatchObject({
      type: "ok",
      value: 4294967295,
    });
    expect(executeTuff("9223372036854775807U64")).toMatchObject({
      type: "ok",
      value: 9223372036854775807,
    });
  });

  it("should compile and execute signed I8/I16/I32/I64 values", () => {
    expect(executeTuff("-128I8")).toMatchObject({ type: "ok", value: -128 });
    expect(executeTuff("127I8")).toMatchObject({ type: "ok", value: 127 });
    expect(executeTuff("-32768I16")).toMatchObject({
      type: "ok",
      value: -32768,
    });
    expect(executeTuff("32767I16")).toMatchObject({ type: "ok", value: 32767 });
    expect(executeTuff("-2147483648I32")).toMatchObject({
      type: "ok",
      value: -2147483648,
    });
    expect(executeTuff("2147483647I32")).toMatchObject({
      type: "ok",
      value: 2147483647,
    });
    expect(executeTuff("-9223372036854775808I64")).toMatchObject({
      type: "ok",
      value: -9223372036854775808,
    });
    expect(executeTuff("9223372036854775807I64")).toMatchObject({
      type: "ok",
      value: 9223372036854775807,
    });
  });

  it("should compile and execute addition of U8 literals", () => {
    const result = executeTuff("1U8 + 2U8");
    expect(result).toMatchObject({ type: "ok", value: 3 });
  });

  it("should fail to compile addition overflow for U8 literals", () => {
    const result = executeTuff("1U8 + 255U8");
    expect(result).toMatchObject({ type: "err" });
  });

  it("should compile and execute mixed-suffix addition", () => {
    const compileResult = compileTuffToTS("1U8 + 255U16");
    console.log("compileResult", compileResult);
    const result = executeTuff("1U8 + 255U16");
    expect(result).toMatchObject({ type: "ok", value: 256 });
  });

  it("should compile and execute mixed-typed-and-untagged addition", () => {
    const result = executeTuff("1U8 + 255 + 1U16");
    expect(result).toMatchObject({ type: "ok", value: 257 });
  });

  it("should compile and execute 3-term U8 addition", () => {
    const result = executeTuff("1U8 + 2U8 + 3U8");
    expect(result).toMatchObject({ type: "ok", value: 6 });
  });

  it("should compile and execute multiplication plus addition", () => {
    const result = executeTuff("10 * 5 + 3");
    expect(result).toMatchObject({ type: "ok", value: 53 });
  });

  it("should compile and execute addition with multiplication precedence", () => {
    const result = executeTuff("10 + 5 * 3");
    expect(result).toMatchObject({ type: "ok", value: 25 });
  });

  it("should compile and execute division", () => {
    const result = executeTuff("10 / 2");
    expect(result).toMatchObject({ type: "ok", value: 5 });
  });

  it("should compile and execute modulus", () => {
    const result = executeTuff("10 % 3");
    expect(result).toMatchObject({ type: "ok", value: 1 });
  });
});
