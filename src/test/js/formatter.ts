import fs from "node:fs";
import path from "node:path";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import {
  compileSourceResult,
  formatTuffSource,
} from "../../main/js/compiler.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");

function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(root, "src", "test", "tuff", "format", name),
    "utf8",
  );
}

function normalizeNewlines(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\n+$/g, "\n");
}

function ensureCompileOk(label: string, source: string): void {
  const result = compileSourceResult(source, `<${label}>`, {
    backend: "selfhost",
    target: "js",
    modules: {
      moduleBaseDir: path.join(root, "src", "main", "tuff"),
    },
  });
  assert.equal(result.ok, true, `${label} should compile successfully`);
}

function main(): void {
  const input = readFixture("basic.input.tuff");
  const expected = readFixture("basic.expected.tuff");

  const formattedResult = formatTuffSource(input, { backend: "selfhost" });
  assert.equal(formattedResult.ok, true, "formatter failed on basic fixture");

  const formatted = formattedResult.ok ? formattedResult.value : "";
  assert.equal(
    normalizeNewlines(formatted),
    normalizeNewlines(expected),
    "formatted output does not match expected fixture",
  );

  const secondResult = formatTuffSource(formatted, { backend: "selfhost" });
  assert.equal(secondResult.ok, true, "formatter failed on idempotence pass");
  const second = secondResult.ok ? secondResult.value : "";
  assert.equal(second, formatted, "formatter is not idempotent");

  ensureCompileOk("formatter-input", input);
  ensureCompileOk("formatter-output", formatted);

  console.log("Formatter checks passed");
}

main();
