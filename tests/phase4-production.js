import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileSource } from "../src/compiler.js";
import { toDiagnostic } from "../src/errors.js";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const outDir = path.join(root, "tests", "out", "stage4");
fs.mkdirSync(outDir, { recursive: true });

// 1) Ensure internal diagnostics contain codes/hints for strict safety failures.
try {
  compileSource(`fn bad(x : I32) : I32 => 100 / x;`, "<phase4>", {
    typecheck: { strictSafety: true },
  });
  console.error("Phase 4 diagnostics test expected strict compile failure");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_SAFETY_DIV_BY_ZERO") {
    console.error(`Expected E_SAFETY_DIV_BY_ZERO, got ${diag.code}`);
    process.exit(1);
  }
  if (!diag.hint || !diag.hint.includes("denominator")) {
    console.error(
      `Expected diagnostic hint about denominator, got: ${diag.hint}`,
    );
    process.exit(1);
  }
}

// 2) Ensure CLI emits machine-readable JSON diagnostics.
const failingFile = path.join(outDir, "cli-fail.tuff");
fs.writeFileSync(failingFile, `fn bad(x : I32) : I32 => 100 / x;`, "utf8");

const cli = spawnSync(
  process.execPath,
  ["./src/cli.js", "compile", failingFile, "--stage2", "--json-errors"],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (cli.status === 0) {
  console.error("CLI expected failure status for invalid strict-safety input");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse((cli.stderr ?? "").trim());
} catch {
  console.error("CLI did not emit valid JSON diagnostics to stderr");
  console.error(cli.stderr);
  process.exit(1);
}

if (parsed.code !== "E_SAFETY_DIV_BY_ZERO") {
  console.error(
    `Expected CLI diagnostic code E_SAFETY_DIV_BY_ZERO, got ${parsed.code}`,
  );
  process.exit(1);
}

console.log("Phase 4 production diagnostics checks passed");
