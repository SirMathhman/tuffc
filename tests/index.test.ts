import { describe, expect, test } from "bun:test";
import path from "node:path";
import { compileTuffToTS } from "../src/index";

async function expectTuff(
  tuffSourceCode: string,
  expectedExitCode: number,
): Promise<void> {
  // Compile the Tuff source code to TypeScript
  const tsCode: string = compileTuffToTS(tuffSourceCode);

  // Apply the config at eslint.config.ts to the generated TypeScript code.
  // ESLint is run in a child node process – importing it in-process, or running
  // it via "bun x ...", causes a Bun 1.2.21 / Windows segfault.
  const repoRoot: string = path.resolve(import.meta.dir, "..");
  const tmpFile: string = path.resolve(repoRoot, "src/_lint_tmp.ts");
  const eslintBin: string = path.resolve(repoRoot, "node_modules/eslint/bin/eslint.js");
  await Bun.write(tmpFile, tsCode);
  let lintExitCode: number;
  try {
    const lintResult: ReturnType<typeof Bun.spawnSync> = Bun.spawnSync(
      ["node", eslintBin, tmpFile],
      { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
    );
    lintExitCode = lintResult.exitCode ?? 1;
  } finally {
    const deleteScript: string = "require('fs').unlinkSync(process.argv[1])";
    Bun.spawnSync(["node", "-e", deleteScript, tmpFile], { cwd: repoRoot });
  }
  expect(lintExitCode).toBe(0);

  // Run the compiled TypeScript and check the exit code
  const result: ReturnType<typeof Bun.spawnSync> = Bun.spawnSync(
    ["bun", "run", "--eval", tsCode],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(result.exitCode).toBe(expectedExitCode);
}

describe("whitespace", () => {
  test("empty string exits 0", async () => {
    await expectTuff("", 0);
  }, 30_000);

  test("single space exits 0", async () => {
    await expectTuff(" ", 0);
  }, 30_000);

  test("mixed whitespace exits 0", async () => {
    await expectTuff("\t\n  ", 0);
  }, 30_000);
});
