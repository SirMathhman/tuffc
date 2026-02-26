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
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const force = process.argv.includes("--force");

process.on("uncaughtException", (err) => {
  console.error(`[build:selfhost-js] FATAL uncaughtException: ${err.message}`);
  console.error(err.stack ?? String(err));
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(
    `[build:selfhost-js] FATAL unhandledRejection: ${String(reason)}`,
  );
  process.exit(1);
});

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

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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
  const MTIME_EPSILON_MS = 2;
  if (outMtime + MTIME_EPSILON_MS >= maxMtime) {
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
  `./src/main/js/cli.ts`,
  `./${relInput}`,
  "--module-base",
  "./src/main/tuff",
  "--target",
  "js",
  "-o",
  `./${relOutput}`,
];

console.log(`[build:selfhost-js] compiling selfhost.tuff → ${relOutput}`);
console.log(`[build:selfhost-js] compiler: tsx ./src/main/js/cli.ts`);

const COMPILE_TIMEOUT_MS = 300_000; // 5 minutes

const t0 = Date.now();
const startedAtIso = new Date(t0).toISOString();
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
if (!fs.existsSync(tsxCli)) {
  console.error(
    `[build:selfhost-js] ERROR: tsx CLI not found at ${tsxCli}. Run npm install in Tuffc/.`,
  );
  process.exit(1);
}
console.log(`[build:selfhost-js] started: ${startedAtIso}`);
console.log(`[build:selfhost-js] cwd: ${root}`);
console.log(`[build:selfhost-js] timeout: ${COMPILE_TIMEOUT_MS / 1000}s`);
console.log(
  `[build:selfhost-js] command: ${process.execPath} ${path.relative(root, tsxCli).replaceAll("\\", "/")} ${args.join(" ")}`,
);
const compileProc = spawnSync(process.execPath, [tsxCli, ...args], {
  cwd: root,
  env,
  stdio: "inherit",
  timeout: COMPILE_TIMEOUT_MS,
});

console.log(
  `[build:selfhost-js] compiler result: status=${String(compileProc.status)} signal=${String(compileProc.signal)} error=${compileProc.error ? "yes" : "no"}`,
);

const elapsed = Date.now() - t0;

if (compileProc.error) {
  const errno = compileProc.error as NodeJS.ErrnoException;
  if (errno.code === "ETIMEDOUT") {
    console.error(
      `[build:selfhost-js] TIMEOUT: compilation exceeded ${COMPILE_TIMEOUT_MS / 1000}s after ${formatElapsed(elapsed)} — process terminated`,
    );
  } else {
    console.error(
      `[build:selfhost-js] FAILED after ${formatElapsed(elapsed)}: ${errno.message}`,
    );
  }
  process.exit(1);
}

if (compileProc.status !== 0) {
  console.error(
    `[build:selfhost-js] FAILED after ${formatElapsed(elapsed)}: compiler exited with code ${String(compileProc.status)}`,
  );
  process.exit(1);
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

// Keep OUT_JS mtime aligned with GENERATED_JS so cache checks don't self-invalidate
// immediately after sync (GENERATED_JS is part of input freshness checks).
try {
  const gStat = fs.statSync(GENERATED_JS);
  fs.utimesSync(OUT_JS, gStat.atime, gStat.mtime);
} catch {
  // Best-effort only; cache still works but may miss more often if this fails.
}
