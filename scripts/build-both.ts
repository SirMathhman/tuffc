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

function run(command: string, args: string[], label: string): void {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 Building ${label}...`);
  console.log(`    $ ${command} ${args.join(" ")}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  });
  if (result.error) {
    console.error(`\n❌ Failed to spawn ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status === null) {
    console.error(`\n❌ ${label} killed by signal: ${result.signal}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `\n❌ Failed to build ${label} (exit code: ${result.status})`,
    );
    process.exit(result.status);
  }
  console.log(`✅ ${label} built successfully`);
}

// Step 1: Build selfhost.js
run(
  "npx",
  ["tsx", "./scripts/build-selfhost-js.ts", ...(force ? ["--force"] : [])],
  "generated.js",
);

// Step 2: Build native parity (Stage 3 native selfhost)
run(
  "npx",
  ["tsx", "./src/test/js/c-bootstrap-parity.ts"],
  "native parity (prerequisite for generated.exe)",
);

// Step 3: Build generated.exe (copy native to dist)
run("npx", ["tsx", "./scripts/build-native-binary.ts"], "generated.exe");

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✨ All build artifacts complete!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
