import vm from "node:vm";
import ts from "typescript";

/**
 * Stub Tuff-to-TypeScript compiler.
 *
 * For now this only returns a numeric literal to reserve the public API.
 */
export function compileTuffToTS(source: string): string {
  void source;
  return "0;";
}

/**
 * Calls the stub Tuff compiler, transpiles TypeScript source to JavaScript,
 * executes the JavaScript, and returns the numeric result.
 *
 * Until `compileTuffToTS` produces TypeScript output, the provided source is
 * treated as TypeScript after the stub is invoked.
 */
export function compileTuffAndExecute(tuffSource: string): number {
  const tsSource = compileTuffToTS(tuffSource);
  const transpileResult = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  if (transpileResult.diagnostics?.length) {
    const diagnosticMessage = ts.formatDiagnosticsWithColorAndContext(
      transpileResult.diagnostics,
      {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
      },
    );

    throw new Error(`TypeScript transpilation failed:\n${diagnosticMessage}`);
  }

  const script = new vm.Script(transpileResult.outputText, {
    filename: "generated.js",
  });

  const result = script.runInNewContext({
    console,
    setTimeout,
    clearTimeout,
  });

  if (typeof result !== "number") {
    throw new Error("Executed JavaScript did not return a number.");
  }

  return result;
}
