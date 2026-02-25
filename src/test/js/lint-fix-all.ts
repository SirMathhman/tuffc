import fs from "node:fs";
import path from "node:path";
import { compileFileResult } from "../../main/js/compiler.ts";
import { formatDiagnostic, toDiagnostic } from "../../main/js/errors.ts";
import { collectFilesByExtension } from "./file-collect-utils.ts";
import {
  getRepoRootFromImportMeta,
  getSrcDir,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const srcDir = getSrcDir(root);
const outBase = getTestsOutDir(root, "lint-fix");

const tuffFiles = collectFilesByExtension(srcDir, ".tuff").sort();
if (tuffFiles.length === 0) {
  console.log("No .tuff files found under src/");
  process.exit(0);
}

fs.mkdirSync(outBase, { recursive: true });

let fixedTotal = 0;
let issueTotal = 0;
for (const filePath of tuffFiles) {
  const rel = path.relative(root, filePath);
  const outPath = path.join(outBase, rel.replace(/\.tuff$/i, ".js"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const result = compileFileResult(filePath, outPath, {
    resolve: {
      allowHostPrefix: "__host_",
    },
    lint: {
      enabled: true,
      fix: true,
      mode: "warn",
    },
  });

  if (!result.ok) {
    const failed = result as { ok: false; error: unknown };
    console.error(`Failed to lint-fix: ${rel}`);
    console.error(formatDiagnostic(toDiagnostic(failed.error)));
    process.exit(1);
  }

  const okResult = result as {
    ok: true;
    value: { lintIssues?: unknown[]; lintFixesApplied?: number };
  };
  const issues = okResult.value.lintIssues ?? [];
  const fixes = okResult.value.lintFixesApplied ?? 0;
  issueTotal += issues.length;
  fixedTotal += fixes;
  if (issues.length > 0) {
    console.log(`Lint issues (${issues.length}) in ${rel}; fixes applied: ${fixes}`);
  } else {
    console.log(`Lint clean: ${rel}; fixes applied: ${fixes}`);
  }
}

console.log(
  `\nDone. Selfhost lint reported ${issueTotal} issue(s) across ${tuffFiles.length} .tuff file(s).`,
);
console.log(
  `Deterministic lint fixes applied: ${fixedTotal}`,
);
