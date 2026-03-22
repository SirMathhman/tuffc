import vm from "node:vm";
import ts from "typescript";

/**
 * Stub Tuff-to-TypeScript compiler.
 *
 * For now this recognizes a minimal numeric literal form and otherwise
 * preserves the public API's zero baseline.
 */
export function compileTuffToTS(source: string): string {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "0;";
  }

  const u8LiteralMatch = /^(\d+)U8$/.exec(trimmedSource);
  if (u8LiteralMatch) {
    return `${Number(u8LiteralMatch[1])};`;
  }

  if (/^read<\s*U8\s*>\(\)$/.test(trimmedSource)) {
    return "read();";
  }

  return "0;";
}

/**
 * Calls the stub Tuff compiler, transpiles TypeScript source to JavaScript,
 * executes the JavaScript, and returns the numeric result.
 *
 * Until `compileTuffToTS` produces TypeScript output, the provided source is
 * treated as TypeScript after the stub is invoked.
 */
export function compileTuffAndExecute(
  tuffSource: string,
  stdIn = "",
): number {
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

  const read = () => {
    const parsedStdIn = Number(stdIn);

    if (!Number.isFinite(parsedStdIn)) {
      throw new Error("Provided stdin did not contain a numeric value.");
    }

    return parsedStdIn;
  };

  const result = script.runInNewContext({
    console,
    setTimeout,
    clearTimeout,
    read,
  });

  if (typeof result !== "number") {
    throw new Error("Executed JavaScript did not return a number.");
  }

  return result;
}
