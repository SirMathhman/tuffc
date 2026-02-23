// @ts-nocheck
/**
 * Test harness for the self-hosted Tuff compiler.
 *
 * Steps:
 * 1. Compile selfhost.tuff using native selfhost executable
 * 2. Load the resulting JS with runtime.js utilities
 * 3. Use the self-hosted compiler to compile a test program
 * 4. Use the self-hosted compiler to compile itself (bootstrap test)
 */

import fs from "node:fs";
import path from "node:path";
import * as runtime from "../../main/js/runtime.ts";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";
import { loadStageCompilerFromJs } from "./stage-matrix-harness.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";
import { FACTORIAL_PROGRAM } from "./test-fixtures.ts";
const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = path.join(root, "tests", "out", "selfhost");

const loadSelfhostCompilerFromJs = loadStageCompilerFromJs;

console.log("Compiling selfhost.tuff with native selfhost executable...");

let selfhostPath;
let selfhostJs;
let selfhost;
try {
  const loaded = compileAndLoadSelfhost(root, outDir);
  selfhostPath = loaded.selfhostPath;
  selfhostJs = loaded.selfhostJs;
  selfhost = loaded.selfhost;
} catch (err) {
  console.error(
    "Failed to compile selfhost.tuff with native selfhost:",
    err.message,
  );
  process.exit(1);
}

console.log("  -> Wrote selfhost.js");

// Step 2 / 3: Load the compiled self-hosted compiler
try {
  selfhost = loadSelfhostCompilerFromJs(selfhostJs);
} catch (err) {
  console.error("Failed to load selfhost.js:", err.message);
  process.exit(1);
}
if (typeof selfhost.compile_source !== "function") {
  console.error("selfhost.compile_source not exported");
  process.exit(1);
}
if (typeof selfhost.compile_file_with_options !== "function") {
  console.error("selfhost.compile_file_with_options not exported");
  process.exit(1);
}

console.log("  -> Self-hosted compiler loaded successfully");

// Step 4: Test compiling a simple program
const simpleProgram = `fn add(x: I32, y: I32) : I32 => x + y;
fn main() : I32 => add(40, 2);`;

console.log("Testing simple program compilation...");
try {
  const simpleJs = selfhost.compile_source(simpleProgram);
  fs.writeFileSync(path.join(outDir, "simple.js"), simpleJs, "utf8");
  console.log("  -> Simple program compiled successfully");

  // Execute the simple program
  const simpleResult = vm.runInNewContext(simpleJs + "\nmain()", {});
  if (simpleResult !== 42) {
    console.error(`  -> Simple program returned ${simpleResult}, expected 42`);
    process.exit(1);
  }
  console.log("  -> Simple program executed: main() = 42");
} catch (err) {
  console.error("Failed to compile simple program:", err.message);
  console.error(err.stack);
  process.exit(1);
}

// Step 5: Test compiling a more complex program (factorial)
const factorialProgram = FACTORIAL_PROGRAM;

console.log("Testing factorial program compilation...");
try {
  const factJs = selfhost.compile_source(factorialProgram);
  fs.writeFileSync(path.join(outDir, "factorial.js"), factJs, "utf8");

  const factResult = vm.runInNewContext(factJs + "\nmain()", {});
  if (factResult !== 120) {
    console.error(`  -> Factorial returned ${factResult}, expected 120`);
    process.exit(1);
  }
  console.log("  -> Factorial program executed: factorial(5) = 120");
} catch (err) {
  console.error("Failed to compile factorial program:", err.message);
  console.error(err.stack);
  process.exit(1);
}

// Step 6: Bootstrap test - compile selfhost.tuff with itself
console.log("Testing bootstrap (self-compilation)...");
try {
  const selfhostBPath = path.join(outDir, "selfhost_b.js");
  selfhost.compile_file_with_options(
    selfhostPath,
    selfhostBPath,
    0,
    0,
    500,
    1,
    "js",
  );
  const selfhostB = fs.readFileSync(selfhostBPath, "utf8");
  fs.writeFileSync(path.join(outDir, "selfhost_b.js"), selfhostB, "utf8");
  console.log("  -> Self-hosted compiler compiled itself!");

  // Verify the bootstrap output is valid JS by loading it
  const selfhostB_compiler = loadSelfhostCompilerFromJs(selfhostB);
  if (typeof selfhostB_compiler.compile_file_with_options !== "function") {
    console.error("selfhost_b compiler missing compile_file_with_options");
    process.exit(1);
  }

  // Triple-compile: use selfhost_b to compile selfhost again
  const selfhostCPath = path.join(outDir, "selfhost_c.js");
  selfhostB_compiler.compile_file_with_options(
    selfhostPath,
    selfhostCPath,
    0,
    0,
    500,
    1,
    "js",
  );
  const selfhostC = fs.readFileSync(selfhostCPath, "utf8");
  fs.writeFileSync(path.join(outDir, "selfhost_c.js"), selfhostC, "utf8");
  console.log("  -> Triple compilation succeeded!");

  // Verify selfhost_b and selfhost_c are equivalent (normalized)
  const normalize = (s) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\s+/g, " ")
      .trim();

  if (normalize(selfhostB) === normalize(selfhostC)) {
    console.log("  -> Bootstrap equivalence verified: B == C");
  } else {
    console.error(
      "  -> Bootstrap equivalence failed: selfhost_b.js and selfhost_c.js differ",
    );
    process.exit(1);
  }
} catch (err) {
  console.error("Bootstrap failed:", err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log("\n=== Self-hosted compiler tests PASSED ===");
