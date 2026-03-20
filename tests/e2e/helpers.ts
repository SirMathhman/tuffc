import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../../src/compiler";

export async function executeCompiledCode(source: string): Promise<string> {
  const result = compile(source);
  if (result.diagnostics.length > 0) {
    throw new Error(result.diagnostics.map((diagnostic) => `${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`).join("\n"));
  }

  const directory = mkdtempSync(join(tmpdir(), "tuffc-e2e-"));
  const outputPath = join(directory, "program.ts");

  await Bun.write(outputPath, result.output);
  const runResult = Bun.spawnSync({ cmd: ["bun", "run", outputPath], stdout: "pipe", stderr: "pipe" });

  rmSync(directory, { recursive: true, force: true });

  if (runResult.exitCode !== 0) {
    const stderr = new TextDecoder().decode(runResult.stderr);
    throw new Error(stderr || `Process exited with code ${runResult.exitCode}.`);
  }

  return new TextDecoder().decode(runResult.stdout).trimEnd();
}