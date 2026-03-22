import vm from "node:vm";
import ts from "typescript";

const INTEGER_RANGES: Record<string, { min: bigint; max: bigint }> = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

const F32_MAX = 3.4028234663852886e38;

export function compileTuffToTS(source: string): string {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "0;";
  }

  const intLiteralMatch = /^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/.exec(
    trimmedSource,
  );
  if (intLiteralMatch) {
    const valueStr = intLiteralMatch[1];
    const typeSuffix = intLiteralMatch[2];
    const range = INTEGER_RANGES[typeSuffix];
    const bigValue = BigInt(valueStr);
    if (bigValue < range.min || bigValue > range.max) {
      throw new Error(
        `Value ${valueStr} is out of range for type ${typeSuffix} (${range.min}..${range.max})`,
      );
    }
    return `${Number(valueStr)};`;
  }

  const floatLiteralMatch = /^(-?\d+(?:\.\d+)?)(F32|F64)$/.exec(trimmedSource);
  if (floatLiteralMatch) {
    const valueStr = floatLiteralMatch[1];
    const typeSuffix = floatLiteralMatch[2];
    const value = Number(valueStr);
    if (!Number.isFinite(value)) {
      throw new Error(
        `Value ${valueStr} is not a finite number for type ${typeSuffix}`,
      );
    }
    if (typeSuffix === "F32" && Math.abs(value) > F32_MAX) {
      throw new Error(
        `Value ${valueStr} is out of range for type F32 (max ±${F32_MAX})`,
      );
    }
    return `${value};`;
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
export function compileTuffAndExecute(tuffSource: string, stdIn = ""): number {
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
