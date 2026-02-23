// @ts-nocheck
import {
  fs,
  path,
  compileSourceResult,
  assertStdlibModuleOutput,
  getRepoRootFromImportMeta,
  compileStdlibJs,
} from "./stdlib-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const panicPath = path.join(root, "src", "main", "tuff-c", "Panic.tuff");

const source = fs.readFileSync(panicPath, "utf8");

if (source.includes("= panic;")) {
  console.error(
    "Panic.tuff should not bind extern functions from non-stdlib panic runtime bucket",
  );
  process.exit(1);
}

const result = compileStdlibJs(
  compileSourceResult,
  source,
  "<panic-module-stdlib-only>",
);

assertStdlibModuleOutput(result, "Panic", "panic_with_code");

console.log("Panic.tuff stdlib-only extern binding checks passed");
