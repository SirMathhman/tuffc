import { ESLint } from "eslint";
import ts from "typescript";
import { resolve } from "path";

const INTEGER_LITERAL = /^(-?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/;

const TYPE_RANGES: Record<string, { min: bigint; max: bigint }> = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

export function compileTuffToTS(source: string): string {
  if (source === "") return "";

  const match = INTEGER_LITERAL.exec(source);
  if (match) {
    const digits = match[1]!;
    const type = match[2]!;
    const value = BigInt(digits);
    const range = TYPE_RANGES[type]!;
    if (value < range.min || value > range.max) {
      throw new Error(
        `Value ${digits} is out of range for type ${type} (${range.min}–${range.max})`,
      );
    }
    return `process.exit(${digits});`;
  }

  throw new Error(`Unable to compile Tuff source: ${source}`);
}

export async function executeTuff(source: string): Promise<number> {
  const tsCode = compileTuffToTS(source);

  // Validate generated TypeScript with ESLint
  const eslint = new ESLint({
    overrideConfigFile: resolve(import.meta.dir, "..", "eslint.config.js"),
    overrideConfig: [
      {
        languageOptions: {
          parserOptions: { project: false },
        },
      },
    ],
  });
  const results = await eslint.lintText(tsCode, {
    filePath: "src/generated.ts",
  });
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  );
  if (errors.length > 0) {
    throw new Error(
      `ESLint validation failed:\n${errors.map((e) => `  ${e.line}:${e.column}  ${e.message}  (${e.ruleId})`).join("\n")}`,
    );
  }

  // Compile TypeScript to JavaScript
  const { outputText } = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  });

  // Execute the compiled JavaScript and return its exit code
  const proc = Bun.spawnSync(["bun", "--eval", outputText]);
  return proc.exitCode ?? 1;
}
