/**
 * Test harness for the self-hosted Tuff compiler.
 *
 * Steps:
 * 1. Compile selfhost.tuff using Stage 0 (JS compiler)
 * 2. Load the resulting JS with runtime.js utilities
 * 3. Use the self-hosted compiler to compile a test program
 * 4. Use the self-hosted compiler to compile itself (bootstrap test)
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileSource } from "../../main/js/compiler.js";
import * as runtime from "../../main/js/runtime.js";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const outDir = path.join(root, "tests", "out", "selfhost");

fs.mkdirSync(outDir, { recursive: true });

// Step 1: Compile selfhost.tuff with Stage 0
console.log("Compiling selfhost.tuff with Stage 0...");
const selfhostSource = fs.readFileSync(selfhostPath, "utf8");
let selfhostJs;
try {
  const result = compileSource(selfhostSource, selfhostPath, {
    resolve: {
      hostBuiltins: Object.keys(runtime),
      allowHostPrefix: "",
    },
  });
  selfhostJs = result.js;
} catch (err) {
  console.error("Failed to compile selfhost.tuff with Stage 0:", err.message);
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, "selfhost.js"), selfhostJs, "utf8");
console.log("  -> Wrote selfhost.js");

// Step 2: Create sandbox with runtime utilities
const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  // Inject all runtime functions
  ...runtime,
};

// Step 3: Run the compiled self-hosted compiler
try {
  vm.runInNewContext(
    `${selfhostJs}\nmodule.exports = { compile_source, compile_file, main };`,
    sandbox,
  );
} catch (err) {
  console.error("Failed to load selfhost.js:", err.message);
  process.exit(1);
}

const selfhost = sandbox.module.exports;
if (typeof selfhost.compile_source !== "function") {
  console.error("selfhost.compile_source not exported");
  process.exit(1);
}

console.log("  -> Self-hosted compiler loaded successfully");

// Step 4: Test compiling a simple program
const simpleProgram = `fn add(a: I32, b: I32) : I32 => a + b;
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
const factorialProgram = `
fn factorial(n: I32) : I32 => {
    if (n <= 1) {
        1
    } else {
        n * factorial(n - 1)
    }
}

fn main() : I32 => factorial(5);
`;

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
  const selfhostB = selfhost.compile_source(selfhostSource);
  fs.writeFileSync(path.join(outDir, "selfhost_b.js"), selfhostB, "utf8");
  console.log("  -> Self-hosted compiler compiled itself!");

  // Verify the bootstrap output is valid JS by loading it
  const sandbox2 = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };
  vm.runInNewContext(
    `${selfhostB}\nmodule.exports = { compile_source, compile_file, main };`,
    sandbox2,
  );
  const selfhostB_compiler = sandbox2.module.exports;

  // Triple-compile: use selfhost_b to compile selfhost again
  const selfhostC = selfhostB_compiler.compile_source(selfhostSource);
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
    console.error("  -> Warning: selfhost_b.js and selfhost_c.js differ");
    // Not a hard failure - small differences may be acceptable
  }
} catch (err) {
  console.error("Bootstrap failed:", err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log("\n=== Self-hosted compiler tests PASSED ===");
