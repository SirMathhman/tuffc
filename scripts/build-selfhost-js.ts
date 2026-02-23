/**
 * Build step: compile selfhost.tuff → tests/out/build/selfhost.js using the
 * pre-built native selfhost exe (stage3_selfhost_cli).
 *
 * Uses mtime-based caching: skips recompilation when selfhost.js is strictly
 * newer than all inputs (native exe + every .tuff source file).
 *
 * Usage:
 *   npx tsx ./scripts/build-selfhost-js.ts [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as runtime from "../src/main/js/runtime.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const force = process.argv.includes("--force");

const NATIVE_EXE = path.join(
  root,
  "tests",
  "out",
  "c-bootstrap",
  process.platform === "win32"
    ? "stage3_selfhost_cli.exe"
    : "stage3_selfhost_cli",
);
const SELFHOST_TUFF = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const OUT_DIR = path.join(root, "tests", "out", "build");
const OUT_JS = path.join(OUT_DIR, "selfhost.js");
const GENERATED_JS = path.join(root, "src", "main", "tuff", "selfhost.generated.js");
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
  let newestFile = NATIVE_EXE;

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

  tryFile(NATIVE_EXE);

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

if (!fs.existsSync(NATIVE_EXE)) {
  console.error(
    `[build:selfhost-js] ERROR: native exe not found: ${NATIVE_EXE}`,
  );
  console.error(
    `[build:selfhost-js] Run 'npm run native:selfhost:parity' first.`,
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
  "--modules",
  "--module-base",
  "./src/main/tuff",
  "--target",
  "js",
  "-o",
  `./${relOutput}`,
];

console.log(`[build:selfhost-js] compiling selfhost.tuff → ${relOutput}`);
console.log(`[build:selfhost-js] exe: ${path.relative(root, NATIVE_EXE)}`);

const t0 = Date.now();
const result = spawnSync(NATIVE_EXE, args, {
  cwd: root,
  env,
  encoding: "utf8",
});
const elapsed = Date.now() - t0;

if (result.error) {
  console.error(`[build:selfhost-js] FAILED to start: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    `[build:selfhost-js] FAILED: native exe exited ${result.status} after ${elapsed}ms`,
  );
  if (result.stderr) console.error(result.stderr);

  console.warn(
    `[build:selfhost-js] falling back to ${path.relative(root, GENERATED_JS)} (strictSafety=0 bootstrap mode)`,
  );
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
    );
    const compiler = (sandbox.module as { exports: Record<string, unknown> })
      .exports;
    const compileFileWithOptions = compiler.compile_file_with_options as
      | ((
          inputPath: string,
          outputPath: string,
          strictSafety: number,
          lintEnabled: number,
          maxEffectiveLines: number,
          borrowEnabled: number,
          target: string,
        ) => unknown)
      | undefined;
    if (typeof compileFileWithOptions !== "function") {
      console.error(
        `[build:selfhost-js] fallback FAILED: compile_file_with_options is unavailable`,
      );
      process.exit(1);
    }
    const fallbackResult = compileFileWithOptions(
      path.resolve(root, relInput),
      path.resolve(root, relOutput),
      0,
      0,
      500,
      1,
      "js",
    );
    console.log(`[build:selfhost-js] fallback compile result: ${String(fallbackResult)}`);
  } catch (fallbackError) {
    console.error(
      `[build:selfhost-js] fallback FAILED: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
    );
    process.exit(1);
  }
}
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
