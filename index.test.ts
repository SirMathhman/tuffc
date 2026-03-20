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
});
