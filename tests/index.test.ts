import { expect } from "bun:test";
import { compileTuffToTS } from "../src/index";

function expectTuff(tuffSourceCode: string, expectedExitCode: number): void {
  // Compile the Tuff source code to TypeScript
  const tsCode = compileTuffToTS(tuffSourceCode);

  // TODO: Apply the config at eslint.config.ts to the generated TypeScript code

  const result = Bun.spawnSync(["bun", "run", "--eval", tsCode], {
    stdout: "inherit",
    stderr: "inherit",
  });

  // Check the exit code
  expect(result.exitCode).toBe(expectedExitCode);
}
