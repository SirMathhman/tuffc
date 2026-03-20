import { compileTuffToTS, type Result } from ".";

const transpiler = new Bun.Transpiler({ loader: "ts" });

function executeTuffCode(tuffSource: string): Result<number, Error> {
  // Step 0: Compile Tuff code to TypeScript
  const compileResult = compileTuffToTS(tuffSource);
  if (compileResult.type === "err") {
    return {
      type: "err",
      error: new Error(`Compilation failed: ${compileResult.error.message}`),
    };
  }

  // Step 2: Compile TypeScript code to JavaScript using Bun's transpiler
  const tsSource = compileResult.value;
  let jsSource: string;
  try {
    jsSource = transpiler.transformSync(tsSource);
  } catch (transpileError) {
    return {
      type: "err",
      error: new Error(`Transpilation failed: ${transpileError}`),
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
    return {
      type: "err",
      error: new Error(`Execution failed: ${executionError}`),
    };
  }
}

describe("The Tuff Compiler", () => {
  it("should compile and execute an empty program", () => {
    const tuffSource = "";
    const result = executeTuffCode(tuffSource);
    expect(result).toMatchObject({ type: "ok", value: 0 });
  });
});
