import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileFile } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import * as runtime from "../../main/js/runtime.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "selfhost", "diagnostics");
const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");

fs.mkdirSync(outDir, { recursive: true });

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
if (typeof selfhost.compile_source !== "function") {
  console.error("selfhost.compile_source not exported");
  process.exit(1);
}

// 1) Invalid syntax should produce structured diagnostics via toDiagnostic.
try {
  selfhost.compile_source("fn broken( : I32 => 0;");
  console.error("Expected selfhost compile_source to fail for invalid syntax");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_SELFHOST_PANIC") {
    console.error(`Expected E_SELFHOST_PANIC, got ${diag.code}`);
    process.exit(1);
  }
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      console.error(
        `Expected selfhost diagnostic field '${key}' to be a non-empty string`,
      );
      process.exit(1);
    }
  }
}

// 2) Missing module path should also produce the same diagnostics contract.
const missingModuleEntry = path.join(outDir, "missing-module-app.tuff");
const missingModuleOut = path.join(outDir, "missing-module-app.js");
fs.writeFileSync(
  missingModuleEntry,
  "let { nope } = com::meti::DoesNotExist;\nfn main() : I32 => nope();\n",
  "utf8",
);

try {
  selfhost.compile_file(missingModuleEntry, missingModuleOut);
  console.error("Expected selfhost compile_file to fail for missing module");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_SELFHOST_PANIC") {
    console.error(
      `Expected missing-module diagnostic code E_SELFHOST_PANIC, got ${diag.code}`,
    );
    process.exit(1);
  }
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      console.error(
        `Expected missing-module diagnostic field '${key}' to be a non-empty string`,
      );
      process.exit(1);
    }
  }
}

console.log("Selfhost diagnostics contract checks passed");
