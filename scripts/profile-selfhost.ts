/**
 * Performance profiler for the Tuff selfhost compiler.
 * Compiles selfhost.tuff and reports detailed timing breakdown.
 */
import path from "path";
import { fileURLToPath } from "url";
import { compileFileResult } from "../src/main/js/compiler.js";
import {
  selfhostPaths,
  selfhostCompileOptions,
  printPhaseBreakdown,
} from "./profile-shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { inputPath, outputPath, moduleBaseDir } = selfhostPaths(__dirname);
const opts = selfhostCompileOptions(moduleBaseDir);

// Warm up V8 JIT with a first run
console.log("=== Warm-up run ===");
const warmStart = performance.now();
const warmResult = compileFileResult(inputPath, outputPath, opts);
const warmElapsed = performance.now() - warmStart;
console.log(`Warm-up: ${warmElapsed.toFixed(1)}ms (ok=${warmResult.ok})`);
if (warmResult.ok && warmResult.value.profileJson) {
  try {
    const marks = JSON.parse(String(warmResult.value.profileJson));
    console.log("\n=== Warm-up Phase Timing ===");
    if (Array.isArray(marks)) {
      for (const m of marks) {
        console.log(`  ${String(m.label).padEnd(30)} ${m.ms}ms`);
      }
    }
  } catch {
    /* ignore */
  }
}

// Run 3 more to get stable numbers
console.log("\n=== Benchmark runs (3x) ===");
const runs: number[] = [];
const allProfiles: Array<Array<{ label: string; ms: number }>> = [];
for (let i = 0; i < 3; i++) {
  const start = performance.now();
  const result = compileFileResult(inputPath, outputPath, opts);
  const elapsed = performance.now() - start;
  runs.push(elapsed);
  console.log(`  Run ${i + 1}: ${elapsed.toFixed(1)}ms`);
  if (result.ok && result.value.profileJson) {
    try {
      allProfiles.push(JSON.parse(String(result.value.profileJson)));
    } catch {
      /* ignore */
    }
  }
}

const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
const min = Math.min(...runs);
console.log(`\n  Average: ${avg.toFixed(1)}ms, Min: ${min.toFixed(1)}ms`);

// Show phase breakdown from last profile
if (allProfiles.length > 0) {
  const last = allProfiles[allProfiles.length - 1];
  if (Array.isArray(last)) {
    console.log("\n=== Phase Breakdown (last run) ===");
    printPhaseBreakdown(last, 6);
  }
}
