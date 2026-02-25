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

function expectSelfhostDiagnostic(
  run: () => void,
  label: string,
  expectedCodePrefixes: string[],
) {
  try {
    run();
    console.error(`Expected ${label} to fail`);
    process.exit(1);
  } catch (error) {
    const diag = toDiagnostic(error);
    const code = String(diag.code ?? "");
    const matches = expectedCodePrefixes.some((prefix) =>
      code.startsWith(prefix),
    );
    if (!matches) {
      console.error(
        `Expected one of [${expectedCodePrefixes.join(", ")}]* diagnostics for ${label}, got ${diag.code}`,
      );
      process.exit(1);
    }
    assertDiagnosticContract(diag, `${label} diagnostic`);
  }
}

// 1) Invalid syntax should produce structured diagnostics via toDiagnostic.
expectSelfhostDiagnostic(
  () => selfhost.compile_source("fn broken( : I32 => 0;"),
  "selfhost compile_source invalid syntax",
  ["E_PARSE_"],
);

// 2) Missing module path should also produce the same diagnostics contract.
const missingModuleEntry = path.join(outDir, "missing-module-app.tuff");
const missingModuleOut = path.join(outDir, "missing-module-app.js");
fs.writeFileSync(
  missingModuleEntry,
  "let { nope } = com::meti::DoesNotExist;\nfn main() : I32 => nope();\n",
  "utf8",
);

expectSelfhostDiagnostic(
  () => selfhost.compile_file(missingModuleEntry, missingModuleOut),
  "selfhost compile_file missing module",
  ["E_MODULE_", "E_SELFHOST_IO_"],
);

const moduleRoot = path.join(outDir, "com", "meti");
fs.mkdirSync(moduleRoot, { recursive: true });

function writeModuleFixture(fileName: string, source: string): string {
  const fullPath = path.join(moduleRoot, fileName);
  fs.writeFileSync(fullPath, source, "utf8");
  return fullPath;
}

// 3) Private import should fail with E_MODULE_PRIVATE_IMPORT.
writeModuleFixture("Private.tuff", "fn hidden() : I32 => 1;\n");
const privateImportEntry = path.join(outDir, "private-import-app.tuff");
const privateImportOut = path.join(outDir, "private-import-app.js");
fs.writeFileSync(
  privateImportEntry,
  "let { hidden } = com::meti::Private;\nfn main() : I32 => hidden();\n",
  "utf8",
);

expectSelfhostDiagnostic(
  () => selfhost.compile_file(privateImportEntry, privateImportOut),
  "selfhost compile_file private import",
  ["E_MODULE_PRIVATE_IMPORT"],
);

// 4) Unknown export should fail with E_MODULE_UNKNOWN_EXPORT.
writeModuleFixture("Known.tuff", "out fn known() : I32 => 1;\n");
const unknownExportEntry = path.join(outDir, "unknown-export-app.tuff");
const unknownExportOut = path.join(outDir, "unknown-export-app.js");
fs.writeFileSync(
  unknownExportEntry,
  "let { missing } = com::meti::Known;\nfn main() : I32 => missing();\n",
  "utf8",
);

expectSelfhostDiagnostic(
  () => selfhost.compile_file(unknownExportEntry, unknownExportOut),
  "selfhost compile_file unknown export",
  ["E_MODULE_UNKNOWN_EXPORT"],
);

// 5) Implicit import should fail with E_MODULE_IMPLICIT_IMPORT.
writeModuleFixture(
  "Library.tuff",
  "out fn sentinel() : I32 => 1;\nout fn shared() : I32 => 2;\n",
);
const implicitImportEntry = path.join(outDir, "implicit-import-app.tuff");
const implicitImportOut = path.join(outDir, "implicit-import-app.js");
fs.writeFileSync(
  implicitImportEntry,
  "let { sentinel } = com::meti::Library;\nfn main() : I32 => shared() + sentinel();\n",
  "utf8",
);

expectSelfhostDiagnostic(
  () => selfhost.compile_file(implicitImportEntry, implicitImportOut),
  "selfhost compile_file implicit import",
  ["E_MODULE_IMPLICIT_IMPORT"],
);

console.log("Selfhost diagnostics contract checks passed");
