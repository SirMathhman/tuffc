// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import { expectDiagnosticCode } from "./compile-test-utils.ts";
import { collectFilesByExtension } from "./file-collect-utils.ts";
import { getRepoRootFromImportMeta, getSrcDir } from "./path-test-utils.ts";
import { STRICT_DIV_BY_ZERO_SOURCE } from "./test-fixtures.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const srcRoot = getSrcDir(root);
const raiseToken = "ra" + "ise(";
const crashToken = "cr" + "ash(";

const offenders = [];
for (const filePath of collectFilesByExtension(srcRoot, ".ts")) {
  const text = fs.readFileSync(filePath, "utf8");
  if (text.includes(raiseToken) || text.includes(crashToken)) {
    offenders.push(path.relative(root, filePath));
  }
}

if (offenders.length > 0) {
  console.error(
    "Expected zero legacy throw-helper callsites under src/**/*.ts",
  );
  for (const offender of offenders) {
    console.error(` - ${offender}`);
  }
  process.exit(1);
}

const badResult = compileSourceResult(
  STRICT_DIV_BY_ZERO_SOURCE,
  "<result-migration>",
  {
    typecheck: { strictSafety: true },
  },
);

if (badResult.ok) {
  console.error(
    "Expected compileSourceResult to return err for strict-safety violation",
  );
  process.exit(1);
}

const diag = toDiagnostic(badResult.error);
expectDiagnosticCode(diag, "E_SAFETY_DIV_BY_ZERO", "result-migration strict");

console.log("Result migration guard checks passed");
