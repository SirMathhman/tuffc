// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";

function formatCompileError(error: any): string {
  const code = error?.code ?? "E_UNKNOWN";
  const message = error?.message ?? String(error);
  const loc = error?.loc
    ? `${error.loc.file ?? "<memory>"}:${error.loc.line ?? "?"}:${error.loc.column ?? "?"}`
    : "<no-loc>";
  const reason = error?.reason ? `\nreason: ${error.reason}` : "";
  const fix = error?.fix ? `\nfix: ${error.fix}` : "";
  return `[${code}] ${message}\nloc: ${loc}${reason}${fix}`;
}

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const ioPath = path.join(root, "src", "main", "tuff-c", "IO.tuff");

const source = fs.readFileSync(ioPath, "utf8");

if (source.includes("= io;")) {
  console.error(
    "IO.tuff should not bind extern functions from non-stdlib io runtime bucket",
  );
  process.exit(1);
}

const result = compileSourceResult(source, "<io-module-stdlib-only>", {
  backend: "selfhost",
  target: "js",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!result.ok) {
  console.error(
    `Expected IO.tuff to compile via selfhost backend, got:\n${formatCompileError(result.error)}`,
  );
  process.exit(1);
}

const output = result.value.output;
if (!output.includes("path_join")) {
  console.error(
    "Expected generated output to include path_join implementation from IO.tuff",
  );
  process.exit(1);
}

console.log("IO.tuff stdlib-only extern binding checks passed");
