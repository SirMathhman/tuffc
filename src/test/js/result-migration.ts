// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const srcRoot = path.join(root, "src");
const raiseToken = "ra" + "ise(";
const crashToken = "cr" + "ash(";

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];
for (const filePath of collectTsFiles(srcRoot)) {
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
  `fn bad(x : I32) : I32 => 100 / x;`,
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
if (diag.code !== "E_SAFETY_DIV_BY_ZERO") {
  console.error(
    `Expected E_SAFETY_DIV_BY_ZERO from compileSourceResult, got ${diag.code}`,
  );
  process.exit(1);
}

console.log("Result migration guard checks passed");
