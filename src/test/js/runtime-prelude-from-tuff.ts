// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const preludePath = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "RuntimePrelude.tuff",
);

const source = fs.readFileSync(preludePath, "utf8");

const result = compileSourceResult(source, "<runtime-prelude-from-tuff>", {
  backend: "selfhost",
  target: "c",
  cSubstrate: "",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!result.ok) {
  console.error(
    `Expected RuntimePrelude.tuff to compile to C, got: ${result.error.message}`,
  );
  process.exit(1);
}

const output = result.value.output;
if (!output.includes("tuff_runtime_panic")) {
  console.error(
    "Expected generated C from RuntimePrelude.tuff to include tuff_runtime_panic symbol",
  );
  process.exit(1);
}

if (!output.includes("tuff_runtime_panic_with_code")) {
  console.error(
    "Expected generated C from RuntimePrelude.tuff to include tuff_runtime_panic_with_code symbol",
  );
  process.exit(1);
}

console.log("Runtime prelude from Tuff compiles to C");
