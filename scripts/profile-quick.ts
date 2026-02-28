/**
 * Quick single-run profiler — just get phase breakdown.
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

console.log("Compiling selfhost.tuff...");
const wallStart = performance.now();
const result = compileFileResult(inputPath, outputPath, opts);
const wallElapsed = performance.now() - wallStart;
console.log(`\nWall time: ${wallElapsed.toFixed(1)}ms (ok=${result.ok})`);

if (result.ok) {
  const pj = String(result.value.profileJson ?? "");
  if (pj.length > 0) {
    try {
      const marks: Array<{ label: string; ms: number }> = JSON.parse(pj);
      console.log("\n=== Phase Breakdown ===");
      printPhaseBreakdown(marks);
    } catch (e) {
      console.log("Profile JSON parse error:", e);
      console.log("Raw:", pj.slice(0, 500));
    }
  } else {
    console.log("No profile data returned.");
  }
}
