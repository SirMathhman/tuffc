#!/usr/bin/env bun
import { spawnSync } from "child_process";

/**
 * check.ts
 *
 * Runs the full validation suite:
 * 1. Linting (eslint)
 * 2. Unit tests (bun test)
 * 3. Duplicate code detection (scripts/find-duplicates.ts)
 * 4. Copy-paste detection (pmd cpd)
 */

console.log("\n[1/4] Running unit tests...");
const testResult = spawnSync("bun", ["test"], { stdio: "inherit" });

if (testResult.status !== 0) {
  console.error("\n[FAIL] Tests failed. Aborting check.");
  process.exit(2);
}

console.log("\n[2/4] Running linter...");
const lintResult = spawnSync("bun", ["run", "lint"], { stdio: "inherit" });

if (lintResult.status !== 0) {
  console.error("\n[FAIL] Linting failed.");
  process.exit(2);
}

console.log("\n[3/4] Checking for duplicate code...");
const dupResult = spawnSync(
  "bun",
  [
    "run",
    "scripts/find-duplicates.ts",
    "src",
    "tests",
    "--min-nodes",
    "6",
    "--suppress-nested",
  ],
  { stdio: "inherit" },
);

if (dupResult.status !== 0) {
  console.error("\n[FAIL] Duplicate check failed.");
  process.exit(2);
}

console.log("\n[4/4] Checking for copy-paste code...");
const cpdResult = spawnSync(
  "pmd",
  [
    "cpd",
    "--dir",
    "src,tests",
    "--language",
    "typescript",
    "--minimum-tokens",
    "35",
    "--ignore-literals",
    "--ignore-identifiers",
  ],
  { stdio: "inherit" },
);

if (cpdResult.status !== 0) {
  console.error("\n[FAIL] Copy-paste check failed.");
  process.exit(2);
}

console.log("\n[PASS] All checks passed!");
process.exit(0);
