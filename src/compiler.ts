import { ESLint } from "eslint";
import ts from "typescript";
import { resolve } from "path";

export function compileTuffToTS(_source: string): string {
  // TODO: implement Tuff -> TypeScript compilation
  return "";
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
