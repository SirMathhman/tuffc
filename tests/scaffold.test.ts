import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../src/compiler";
import { main } from "../src/main";

test("compiles a hello world program", () => {
  const result = compile(`fn main() => {\n  print("Hello, World!");\n};`);

  expect(result.diagnostics).toEqual([]);
  expect(result.output).toContain(`console.log("Hello, World!")`);
  expect(result.output).toContain("main();");
});

test("cli writes a ts output file", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tuffc-"));
  const inputPath = join(directory, "hello.tuff");
  const outputPath = join(directory, "hello.ts");

  await writeFile(inputPath, `fn main() => {\n  print("Hello, CLI!");\n};`);

  const exitCode = await main([inputPath, "-o", outputPath]);
  expect(exitCode).toBe(0);

  const output = await Bun.file(outputPath).text();
  expect(output).toContain(`console.log("Hello, CLI!")`);

  await rm(directory, { recursive: true, force: true });
});
