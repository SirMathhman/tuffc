#!/usr/bin/env bun
import { spawnSync } from "child_process";

/**
 * check.ts
 *
 * Runs the full validation suite:
 * 1. Linting (eslint)
 * 2. Unit tests (bun test)
 * 3. Duplicate code detection (scripts/find-duplicates.ts)
 */

console.log("\n[1/3] Running linter...");
const lintResult = spawnSync("bun", ["run", "lint"], { stdio: "inherit" });

if (lintResult.status !== 0) {
  console.error("\n❌ Linting failed.");
  process.exit(lintResult.status ?? 1);
}

console.log("\n[2/3] Running unit tests...");
const testResult = spawnSync("bun", ["test"], { stdio: "inherit" });

if (testResult.status !== 0) {
  console.error("\n❌ Tests failed. Aborting check.");
  process.exit(testResult.status ?? 1);
}

console.log("\n[3/3] Checking for duplicate code...");
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
  console.error("\n❌ Duplicate check failed.");
  process.exit(dupResult.status ?? 1);
}

console.log("\n✅ All checks passed!");
process.exit(0);
