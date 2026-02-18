// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const panicPath = path.join(root, "src", "main", "tuff-c", "Panic.tuff");

const source = fs.readFileSync(panicPath, "utf8");

if (source.includes("= panic;")) {
  console.error(
    "Panic.tuff should not bind extern functions from non-stdlib panic runtime bucket",
  );
  process.exit(1);
}

const result = compileSourceResult(source, "<panic-module-stdlib-only>", {
  backend: "selfhost",
  target: "js",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!result.ok) {
  console.error(
    `Expected Panic.tuff to compile via selfhost backend, got: ${result.error.message}`,
  );
  process.exit(1);
}

const output = result.value.output;
if (!output.includes("panic_with_code")) {
  console.error(
    "Expected generated output to include panic_with_code implementation from Panic.tuff",
  );
  process.exit(1);
}

console.log("Panic.tuff stdlib-only extern binding checks passed");
