// @ts-nocheck
// Shared imports and utilities for stdlib-only module tests.
export { default as fs } from "node:fs";
export { default as path } from "node:path";
export { compileSourceResult } from "../../main/js/compiler.ts";
export { assertStdlibModuleOutput } from "./compile-test-utils.ts";
export { getRepoRootFromImportMeta } from "./path-test-utils.ts";

export function compileStdlibJs(compileSourceResultFn, source, label) {
  return compileSourceResultFn(source, label, {
    backend: "selfhost",
    target: "js",
    lint: { enabled: false },
    borrowcheck: { enabled: false },
    typecheck: { strictSafety: false },
  });
}
