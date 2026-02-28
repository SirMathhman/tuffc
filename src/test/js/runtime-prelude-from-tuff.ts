// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { compileToCEmpty } from "./compile-test-utils.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const preludePath = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "RuntimePrelude.tuff",
);

const source = fs.readFileSync(preludePath, "utf8");

const output = compileToCEmpty(
  compileSourceResult,
  source,
  "RuntimePrelude.tuff to compile to C",
);
if (
  !output.includes("tuff_runtime_panic") &&
  !output.includes("tuffRuntimePanic")
) {
  console.error(
    "Expected generated C from RuntimePrelude.tuff to include tuff_runtime_panic symbol",
  );
  process.exit(1);
}

if (
  !output.includes("tuff_runtime_panic_with_code") &&
  !output.includes("tuffRuntimePanicWithCode")
) {
  console.error(
    "Expected generated C from RuntimePrelude.tuff to include tuff_runtime_panic_with_code symbol",
  );
  process.exit(1);
}

console.log("Runtime prelude from Tuff compiles to C");
