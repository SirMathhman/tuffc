/**
 * Quick instrumentation: count how many times rslvUtilsFindDidYouMean and levenshteinDistance are called.
 */
import path from "path";
import { fileURLToPath } from "url";
import { selfhostPaths, selfhostCompileOptions } from "./profile-shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Intercept vecGet/vecSet to count calls
  const runtime = await import("../src/main/js/runtime.js");

  let levenCalls = 0;
  let didYouMeanCalls = 0;

  // Monkey-patch the generated code by loading the selfhost and wrapping
  const { compileFileResult } = await import("../src/main/js/compiler.js");

  const origVecGet = runtime.vecGet;
  let vecGetCalls = 0;
  // Can't easily monkey-patch since these are module exports used by generated code
  // Instead, let's just run and check timing

  const { inputPath, outputPath, moduleBaseDir } = selfhostPaths(__dirname);
  const opts = selfhostCompileOptions(moduleBaseDir);

  console.log("Running compilation...");
  const start = performance.now();
  compileFileResult(inputPath, outputPath, {
    ...opts,
    borrowcheck: { enabled: false },
  });
  console.log(`No borrowcheck: ${(performance.now() - start).toFixed(1)}ms`);

  const start2 = performance.now();
  compileFileResult(inputPath, outputPath, opts);
  console.log(`With borrowcheck: ${(performance.now() - start2).toFixed(1)}ms`);
}

main().catch(console.error);
