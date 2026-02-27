/**
 * Build both generated.js and generated.exe in order.
 *
 * Sequence:
 *   1. Build selfhost.js (JS version of the compiler)
 *   2. Build native parity (Stage 3 native selfhost)
 *   3. Build generated.exe (native executable)
 *
 * Usage:
 *   npx tsx ./scripts/build-both.ts [--force]
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const force = args.includes("--force");

function run(command: string, args: string[], label: string): number {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 Building ${label}...`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    console.error(
      `\n❌ Failed to build ${label} (exit code: ${result.status})`,
    );
    process.exit(1);
  }
  console.log(`✅ ${label} built successfully`);
  return result.status ?? 0;
}

// Step 1: Build selfhost.js
run(
  "npx",
  [
    "tsx",
    "./scripts/with-timeout.ts",
    "180000",
    "tsx",
    "./scripts/build-selfhost-js.ts",
    force ? "--force" : "",
  ].filter((x) => x !== ""),
  "generated.js",
);

// Step 2: Build native parity (Stage 3 native selfhost)
run(
  "npx",
  [
    "tsx",
    "./scripts/with-timeout.ts",
    "180000",
    "tsx",
    "./src/test/js/c-bootstrap-parity.ts",
  ].filter((x) => x !== ""),
  "native parity (prerequisite for generated.exe)",
);

// Step 3: Build generated.exe (copy native to dist)
run(
  "npx",
  [
    "tsx",
    "./scripts/with-timeout.ts",
    "180000",
    "tsx",
    "./scripts/build-native-binary.ts",
  ].filter((x) => x !== ""),
  "generated.exe",
);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✨ All build artifacts complete!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
