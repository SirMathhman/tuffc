import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFileResult } from "../../main/js/compiler.ts";
import { formatDiagnostic, toDiagnostic } from "../../main/js/errors.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const srcDir = path.join(root, "src");
const outBase = path.join(root, "tests", "out", "lint-fix");

function collectTuffFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTuffFiles(full));
      continue;
    }
    if (entry.isFile() && full.toLowerCase().endsWith(".tuff")) {
      files.push(full);
    }
  }
  return files;
}

const tuffFiles = collectTuffFiles(srcDir).sort();
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
      fix: false,
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
    value: { lintIssues?: unknown[] };
  };
  const issues = okResult.value.lintIssues ?? [];
  issueTotal += issues.length;
  if (issues.length > 0) {
    console.log(`Lint issues (${issues.length}) in ${rel}`);
  } else {
    console.log(`Lint clean: ${rel}`);
  }
}

console.log(
  `\nDone. Selfhost lint reported ${issueTotal} issue(s) across ${tuffFiles.length} .tuff file(s).`,
);
console.log(
  "Note: lint auto-fix rewriting is currently unsupported in the selfhost-only lint pipeline.",
);
