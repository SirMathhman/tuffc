// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { toDiagnostic } from "../../main/js/errors.ts";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";
import { assertDiagnosticContract } from "./diagnostic-contract-utils.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "selfhost", "diagnostics");
const { selfhost } = compileAndLoadSelfhost(root, outDir);
if (typeof selfhost.compile_source !== "function") {
  console.error("selfhost.compile_source not exported");
  process.exit(1);
}

function expectSelfhostPanic(run: () => void, label: string) {
  try {
    run();
    console.error(`Expected ${label} to fail`);
    process.exit(1);
  } catch (error) {
    const diag = toDiagnostic(error);
    if (diag.code !== "E_SELFHOST_PANIC") {
      console.error(`Expected E_SELFHOST_PANIC for ${label}, got ${diag.code}`);
      process.exit(1);
    }
    assertDiagnosticContract(diag, `${label} diagnostic`);
  }
}

// 1) Invalid syntax should produce structured diagnostics via toDiagnostic.
expectSelfhostPanic(
  () => selfhost.compile_source("fn broken( : I32 => 0;"),
  "selfhost compile_source invalid syntax",
);

// 2) Missing module path should also produce the same diagnostics contract.
const missingModuleEntry = path.join(outDir, "missing-module-app.tuff");
const missingModuleOut = path.join(outDir, "missing-module-app.js");
fs.writeFileSync(
  missingModuleEntry,
  "let { nope } = com::meti::DoesNotExist;\nfn main() : I32 => nope();\n",
  "utf8",
);

expectSelfhostPanic(
  () => selfhost.compile_file(missingModuleEntry, missingModuleOut),
  "selfhost compile_file missing module",
);

console.log("Selfhost diagnostics contract checks passed");
