import { expect } from "bun:test";
import path from "node:path";
import { ESLint } from "eslint";
import { compileTuffToTS } from "../src/index";

async function expectTuff(
  tuffSourceCode: string,
  expectedExitCode: number,
): Promise<void> {
  // Compile the Tuff source code to TypeScript
  const tsCode: string = compileTuffToTS(tuffSourceCode);

  // Apply the config at eslint.config.ts to the generated TypeScript code
  const configPath: string = path.resolve(
    import.meta.dir,
    "../eslint.config.ts",
  );
  const eslint: ESLint = new ESLint({ overrideConfigFile: configPath });
  const lintResults: ESLint.LintResult[] = await eslint.lintText(tsCode, {
    filePath: path.resolve(import.meta.dir, "../src/generated.ts"),
  });
  const hasErrors: boolean = lintResults.some(
    (r: ESLint.LintResult) => r.errorCount > 0,
  );
  expect(hasErrors).toBe(false);

  const result: ReturnType<typeof Bun.spawnSync> = Bun.spawnSync(
    ["bun", "run", "--eval", tsCode],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  // Check the exit code
  expect(result.exitCode).toBe(expectedExitCode);
}
