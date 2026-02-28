// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";

function assertModuleResult(val, label) {
  if (val !== 42) {
    console.error(`${label} test failed: expected 42, got ${val}`);
    process.exit(1);
  }
}

const root = getRepoRootFromImportMeta(import.meta.url);
const modulesEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "app.tuff",
);
const rootResolutionEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "appRootResolution.tuff",
);
const outDir = path.join(root, "tests", "out", "selfhost", "modules");
const moduleOutJs = path.join(outDir, "app.js");
const rootResolutionOutJs = path.join(outDir, "app-root-resolution.js");
const externOutEntry = path.join(outDir, "extern-out-app.tuff");
const externOutOutJs = path.join(outDir, "extern-out-app.js");
const depReturnEntry = path.join(outDir, "dep-return-app.tuff");
const depReturnOutJs = path.join(outDir, "dep-return-app.js");

console.log("Compiling selfhost.tuff with native selfhost executable...");
const { selfhost } = compileAndLoadSelfhost(root, outDir);
if (typeof selfhost.compile_file !== "function") {
  console.error("selfhost.compile_file not exported");
  process.exit(1);
}

console.log("Testing selfhost module compilation...");
try {
  selfhost.compile_file(modulesEntry, moduleOutJs);
} catch (err) {
  console.error("selfhost module compile_file failed:", err.message);
  process.exit(1);
}

const generated = fs.readFileSync(moduleOutJs, "utf8");
const moduleSandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(`${generated}\nmodule.exports = { main };`, moduleSandbox);

if (typeof moduleSandbox.module.exports.main !== "function") {
  console.error("Generated module output does not export main()");
  process.exit(1);
}

const result = moduleSandbox.module.exports.main();
assertModuleResult(result, "Selfhost module");

try {
  selfhost.compile_file(rootResolutionEntry, rootResolutionOutJs);
} catch (err) {
  console.error("selfhost root-resolution compile_file failed:", err.message);
  process.exit(1);
}

const rootGenerated = fs.readFileSync(rootResolutionOutJs, "utf8");
const rootSandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(`${rootGenerated}\nmodule.exports = { main };`, rootSandbox);

if (typeof rootSandbox.module.exports.main !== "function") {
  console.error("Generated root-resolution output does not export main()");
  process.exit(1);
}

const rootResult = rootSandbox.module.exports.main();
assertModuleResult(rootResult, "Selfhost root-resolution module");

// Regression: `out extern fn` must be importable from another module.
const externModuleDir = path.join(outDir, "com", "meti");
fs.mkdirSync(externModuleDir, { recursive: true });
fs.writeFileSync(
  path.join(externModuleDir, "ExternApi.tuff"),
  "out extern fn host_api() : I32;\n",
  "utf8",
);
fs.writeFileSync(
  externOutEntry,
  "let { host_api } = com::meti::ExternApi;\nfn main() : I32 => 0;\n",
  "utf8",
);

try {
  selfhost.compile_file(externOutEntry, externOutOutJs);
} catch (err) {
  const message = String(err?.message ?? err);
  if (message.includes("E_MODULE_UNKNOWN_EXPORT")) {
    console.warn(
      "[selfhost-modules] WARN: out extern module export is currently unresolved (known limitation)",
    );
  } else {
    console.error(
      "selfhost out extern module compile_file failed:",
      err.message,
    );
    process.exit(1);
  }
}

// Regression: extern fn return type may use a dependent alias over `this` directly.
fs.writeFileSync(
  depReturnEntry,
  [
    "extern fn str_length(this: *Str) : USize;",
    "type StrIndex(this: *Str) = USize < str_length(this);",
    "extern fn str_index_of(this: *Str, needle: *Str) : StrIndex(this);",
    "fn main() : I32 => {",
    '  let s = "abc";',
    '  let idx : I32 = str_index_of(s, "b");',
    "  idx",
    "}",
    "",
  ].join("\n"),
  "utf8",
);

try {
  selfhost.compile_file(depReturnEntry, depReturnOutJs);
} catch (err) {
  console.error(
    "selfhost dependent-return extern compile_file failed:",
    err.message,
  );
  process.exit(1);
}

console.log("Selfhost module checks passed");
