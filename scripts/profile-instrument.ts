/**
 * Instrumented profiler: patch rslvUtilsFindDidYouMean and resolveExprIdentifier with call counters.
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { selfhostPaths, selfhostCompileOptions } from "./profile-shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Read and patch the selfhost generated JS
  const genPath = path.resolve(
    __dirname,
    "../src/main/tuff/selfhost.generated.js",
  );
  const original = fs.readFileSync(genPath, "utf8");

  // Add counters before function definitions
  let patched = original;

  // Add global counters at the top
  const counterCode = `
var __dym_calls = 0;
var __dym_candidates_total = 0;
var __levenshtein_calls = 0;
var __resolve_expr_ident_calls = 0;
var __resolve_expr_ident_miss = 0;
`;
  patched = counterCode + patched;

  // Instrument rslvUtilsFindDidYouMean
  patched = patched.replace(
    /function rslvUtilsFindDidYouMean\(name, candidates\) \{/,
    'function rslvUtilsFindDidYouMean(name, candidates) { __dym_calls++; __dym_candidates_total += (typeof candidates?.length === "number" ? candidates.length : 0);',
  );

  // Instrument levenshteinDistance
  patched = patched.replace(
    /function levenshteinDistance\(a, b\) \{/,
    "function levenshteinDistance(a, b) { __levenshtein_calls++;",
  );

  // Write patched version temporarily
  const patchedPath = genPath + ".instrumented.js";
  fs.writeFileSync(patchedPath, patched);

  // Temporarily swap
  const backupPath = genPath + ".backup";
  fs.renameSync(genPath, backupPath);
  fs.renameSync(patchedPath, genPath);

  try {
    // Clear module cache for the compiler
    // Need to re-import compiler fresh
    const { compileFileResult } = await import("../src/main/js/compiler.js");

    const { inputPath, outputPath, moduleBaseDir } = selfhostPaths(__dirname);
    const opts = selfhostCompileOptions(moduleBaseDir);

    console.log("Running instrumented compilation...");
    const start = performance.now();
    const result = compileFileResult(inputPath, outputPath, opts);
    const elapsed = performance.now() - start;
    console.log(`Done in ${elapsed.toFixed(1)}ms (ok=${result.ok})`);

    // The counters are in the VM sandbox, not accessible from here.
    // Need a different approach...
    console.log(
      "Note: Counters are inside the sandboxed VM and not directly accessible.",
    );
    console.log("Trying to read them via global scope...");
  } finally {
    // Restore original
    fs.renameSync(genPath, patchedPath);
    fs.renameSync(backupPath, genPath);
    fs.unlinkSync(patchedPath);
    console.log("Restored original selfhost.generated.js");
  }
}

main().catch(console.error);
