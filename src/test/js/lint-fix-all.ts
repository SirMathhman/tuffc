import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFile } from "../../main/js/compiler.ts";

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
for (const filePath of tuffFiles) {
  const rel = path.relative(root, filePath);
  const outPath = path.join(outBase, rel.replace(/\.tuff$/i, ".js"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const result = compileFile(filePath, outPath, {
    resolve: {
      allowHostPrefix: "__host_",
    },
    lint: {
      enabled: true,
      fix: true,
      mode: "warn",
    },
  }) as {
    lintFixesApplied?: number;
    lintFixedSource?: string | null;
  };

  const applied = result.lintFixesApplied ?? 0;
  fixedTotal += applied;
  if (applied > 0) {
    fs.writeFileSync(
      filePath,
      result.lintFixedSource ?? fs.readFileSync(filePath, "utf8"),
      "utf8",
    );
    console.log(`Fixed ${applied} issue(s): ${rel}`);
  } else {
    console.log(`No fixes needed: ${rel}`);
  }
}

console.log(
  `\nDone. Applied ${fixedTotal} total lint auto-fix(es) across ${tuffFiles.length} .tuff file(s).`,
);
