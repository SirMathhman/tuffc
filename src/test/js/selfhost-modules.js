import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileSource } from "../../main/js/compiler.js";
import * as runtime from "../../main/js/runtime.js";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");

const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const modulesEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "app.tuff",
);
const outDir = path.join(root, "tests", "out", "selfhost", "modules");
const moduleOutJs = path.join(outDir, "app.js");

fs.mkdirSync(outDir, { recursive: true });

console.log("Compiling selfhost.tuff with Stage 0...");
const selfhostSource = fs.readFileSync(selfhostPath, "utf8");
const selfhostResult = compileSource(selfhostSource, selfhostPath, {
  resolve: {
    hostBuiltins: Object.keys(runtime),
    allowHostPrefix: "",
  },
});

const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  ...runtime,
};

vm.runInNewContext(
  `${selfhostResult.js}\nmodule.exports = { compile_source, compile_file, main };`,
  sandbox,
);

const selfhost = sandbox.module.exports;
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
if (result !== 42) {
  console.error(`Selfhost module test failed: expected 42, got ${result}`);
  process.exit(1);
}

console.log("Selfhost module checks passed");
