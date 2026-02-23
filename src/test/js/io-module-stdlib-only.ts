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
const ioPath = path.join(root, "src", "main", "tuff-c", "IO.tuff");

const source = fs.readFileSync(ioPath, "utf8");

if (source.includes("= io;")) {
  console.error(
    "IO.tuff should not bind extern functions from non-stdlib io runtime bucket",
  );
  process.exit(1);
}

const result = compileStdlibJs(
  compileSourceResult,
  source,
  "<io-module-stdlib-only>",
);

assertStdlibModuleOutput(result, "IO", "path_join");

console.log("IO.tuff stdlib-only extern binding checks passed");
