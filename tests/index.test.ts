import { expect } from "bun:test";
import { compileTuffToTS } from "../src/index";

function expectTuff(tuffSourceCode: string, expectedExitCode: number): void {
  // Compile the Tuff source code to TypeScript
  const tsCode: string = compileTuffToTS(tuffSourceCode);

  // TODO: Apply the config at eslint.config.ts to the generated TypeScript code

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
