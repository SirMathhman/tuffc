/**
 * Build step: compile selfhost.tuff → tests/out/build/selfhost.js using the
 * JS bootstrap compiler (selfhost.generated.js).
 *
 * Uses mtime-based caching: skips recompilation when selfhost.js is strictly
 * newer than all inputs (bootstrap JS + every .tuff source file).
 *
 * Usage:
 *   npx tsx ./scripts/build-selfhost-js.ts [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as runtime from "../src/main/js/runtime.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const force = process.argv.includes("--force");

const SELFHOST_TUFF = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const OUT_DIR = path.join(root, "tests", "out", "build");
const OUT_JS = path.join(OUT_DIR, "selfhost.js");
const GENERATED_JS = path.join(
  root,
  "src",
  "main",
  "tuff",
  "selfhost.generated.js",
);
const SUBSTRATE_PATH = path.join(
  root,
  "tests",
  "out",
  "c-bootstrap",
  "embedded_c_substrate.c",
);
const PRELUDE_PATH = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "RuntimePrelude.tuff",
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectTuffMaxMtime(dir: string): number {
  let maxMtime = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return maxMtime;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      maxMtime = Math.max(maxMtime, collectTuffMaxMtime(full));
    } else if (entry.isFile() && entry.name.endsWith(".tuff")) {
      try {
        maxMtime = Math.max(maxMtime, fs.statSync(full).mtimeMs);
      } catch {
        /* ignore */
      }
    }
  }
  return maxMtime;
}

function computeInputsMaxMtime(): { maxMtime: number; newestFile: string } {
  let maxMtime = 0;
  let newestFile = GENERATED_JS;

  const tryFile = (p: string, label?: string) => {
    try {
      const m = fs.statSync(p).mtimeMs;
      if (m > maxMtime) {
        maxMtime = m;
        newestFile = label ?? p;
      }
    } catch {
      /* ignore */
    }
  };

  tryFile(GENERATED_JS);

  for (const dir of [
    path.join(root, "src", "main", "tuff"),
    path.join(root, "src", "main", "tuff-core"),
  ]) {
    const m = collectTuffMaxMtime(dir);
    if (m > maxMtime) {
      maxMtime = m;
      newestFile = `${dir} (tuff tree)`;
    }
  }

  return { maxMtime, newestFile };
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(GENERATED_JS)) {
  console.error(
    `[build:selfhost-js] ERROR: bootstrap compiler not found: ${GENERATED_JS}`,
  );
  console.error(
    `[build:selfhost-js] Regenerate it from source control or restore the file to continue.`,
  );
  process.exit(1);
}

// Cache check
if (!force && fs.existsSync(OUT_JS)) {
  const outMtime = fs.statSync(OUT_JS).mtimeMs;
  const { maxMtime, newestFile } = computeInputsMaxMtime();
  if (outMtime > maxMtime) {
    const rel = path.relative(root, OUT_JS);
    const newestRel = newestFile.startsWith(root)
      ? path.relative(root, newestFile.split(" ")[0]) +
        (newestFile.includes(" ") ? " (tuff tree)" : "")
      : newestFile;
    console.log(
      `[build:selfhost-js] ✓ cache hit — ${rel} is up-to-date (newer than ${newestRel} by ${outMtime - maxMtime}ms)`,
    );
    process.exit(0);
  } else {
    const newestRel = newestFile.startsWith(root)
      ? path.relative(root, newestFile.split(" ")[0]) +
        (newestFile.includes(" ") ? " (tuff tree)" : "")
      : newestFile;
    console.log(
      `[build:selfhost-js] cache miss — ${newestRel} is newer than selfhost.js by ${maxMtime - outMtime}ms, recompiling`,
    );
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const relInput = path.relative(root, SELFHOST_TUFF).replaceAll("\\", "/");
const relOutput = path.relative(root, OUT_JS).replaceAll("\\", "/");

const env: NodeJS.ProcessEnv = { ...process.env };
if (fs.existsSync(SUBSTRATE_PATH)) env.TUFFC_SUBSTRATE_PATH = SUBSTRATE_PATH;
if (fs.existsSync(PRELUDE_PATH)) env.TUFFC_PRELUDE_PATH = PRELUDE_PATH;

const args = [
  `./${relInput}`,
  "--module-base",
  "./src/main/tuff",
  "--target",
  "js",
  "-o",
  `./${relOutput}`,
];

console.log(`[build:selfhost-js] compiling selfhost.tuff → ${relOutput}`);
console.log(
  `[build:selfhost-js] compiler: ${path.relative(root, GENERATED_JS)} (bootstrap JS)`,
);

const COMPILE_TIMEOUT_MS = 120_000; // 2 minutes

const t0 = Date.now();
try {
  const generatedJs = fs.readFileSync(GENERATED_JS, "utf8");
  const sandbox: Record<string, unknown> = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };
  vm.runInNewContext(
    `${generatedJs}\nmodule.exports = { compile_file_with_options };`,
    sandbox,
    { timeout: COMPILE_TIMEOUT_MS },
  );
  const compiler = (sandbox.module as { exports: Record<string, unknown> })
    .exports;
  const compileFileWithOptions = compiler.compile_file_with_options as
    | ((
        inputPath: string,
        outputPath: string,
        lintEnabled: number,
        maxEffectiveLines: number,
        borrowEnabled: number,
        target: string,
      ) => unknown)
    | undefined;
  if (typeof compileFileWithOptions !== "function") {
    console.error(
      `[build:selfhost-js] FAILED: compile_file_with_options is unavailable in ${path.relative(root, GENERATED_JS)}`,
    );
    process.exit(1);
  }

  // Watchdog timer: kill process if compilation hangs
  const watchdog = setTimeout(() => {
    console.error(
      `[build:selfhost-js] TIMEOUT: compilation exceeded ${COMPILE_TIMEOUT_MS / 1000}s — aborting`,
    );
    process.exit(1);
  }, COMPILE_TIMEOUT_MS);
  watchdog.unref(); // don't keep event loop alive if compile finishes

  const compileResult = compileFileWithOptions(
    path.resolve(root, relInput),
    path.resolve(root, relOutput),
    0,
    500,
    1,
    "js",
  );

  clearTimeout(watchdog);
  console.log(`[build:selfhost-js] compile result: ${String(compileResult)}`);
} catch (compileError) {
  const msg =
    compileError instanceof Error ? compileError.message : String(compileError);
  if (msg.includes("Script execution timed out")) {
    console.error(
      `[build:selfhost-js] TIMEOUT: vm.runInNewContext exceeded ${COMPILE_TIMEOUT_MS / 1000}s`,
    );
  } else {
    console.error(`[build:selfhost-js] FAILED: ${msg}`);
  }
  process.exit(1);
}
const elapsed = Date.now() - t0;
if (!fs.existsSync(OUT_JS)) {
  console.error(
    `[build:selfhost-js] FAILED: output file not produced: ${OUT_JS}`,
  );
  process.exit(1);
}

const size = fs.statSync(OUT_JS).size;
console.log(
  `[build:selfhost-js] ✓ built ${relOutput} (${(size / 1024).toFixed(0)} KB) in ${elapsed}ms`,
);

// Also sync to selfhost.generated.js so compiler.ts's backend:"selfhost" path stays current.
fs.copyFileSync(OUT_JS, GENERATED_JS);
const genRel = path.relative(root, GENERATED_JS).replaceAll("\\", "/");
console.log(`[build:selfhost-js] ✓ synced → ${genRel}`);
