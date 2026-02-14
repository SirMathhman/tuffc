import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileFile } from "../../main/js/compiler.ts";
import * as runtime from "../../main/js/runtime.ts";

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
const rootResolutionEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "app_root_resolution.tuff",
);
const outDir = path.join(root, "tests", "out", "selfhost", "modules");
const moduleOutJs = path.join(outDir, "app.js");
const rootResolutionOutJs = path.join(outDir, "app-root-resolution.js");

fs.mkdirSync(outDir, { recursive: true });

console.log("Compiling selfhost.tuff with Stage 0...");
const selfhostResult = compileFile(
  selfhostPath,
  path.join(outDir, "selfhost.js"),
  {
    enableModules: true,
    modules: { moduleBaseDir: path.dirname(selfhostPath) },
    resolve: {
      hostBuiltins: Object.keys(runtime),
      allowHostPrefix: "",
    },
  },
);

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
if (rootResult !== 42) {
  console.error(
    `Selfhost root-resolution module test failed: expected 42, got ${rootResult}`,
  );
  process.exit(1);
}

console.log("Selfhost module checks passed");
