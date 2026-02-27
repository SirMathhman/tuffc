/**
 * Build step: compile selfhost.tuff → tests/out/build/selfhost.js using the
 * JS bootstrap compiler (selfhost.generated.js).
 *
 * Uses content-hash (SHA-256) manifest caching: skips recompilation when all
 * input file hashes match the stored manifest AND the output file exists.
 * Mtime-based caching is used as a fast pre-check before hashing.
 *
 * Manifest file: tests/out/build/build-manifest.json
 *
 * Usage:
 *   npx tsx ./scripts/build-selfhost-js.ts [--force]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

interface BuildManifest {
  /** map from repo-relative path (forward slashes) → sha256 hex */
  inputs: Record<string, string>;
  /** sha256 of the output file at the time it was written */
  outputSha256: string;
}

const MANIFEST_PATH = path.join(OUT_DIR, "build-manifest.json");

function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function collectTuffFiles(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTuffFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith(".tuff")) {
      results.push(full);
    }
  }
  return results;
}

function collectInputFiles(): string[] {
  const files: string[] = [GENERATED_JS];
  for (const dir of [
    path.join(root, "src", "main", "tuff"),
    path.join(root, "src", "main", "tuff-core"),
  ]) {
    collectTuffFiles(dir, files);
  }
  return files;
}

function toRelKey(p: string): string {
  return path.relative(root, p).replaceAll("\\", "/");
}

function loadManifest(): BuildManifest | null {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as BuildManifest;
  } catch {
    return null;
  }
}

function writeManifest(inputFiles: string[]): void {
  const inputs: Record<string, string> = {};
  for (const f of inputFiles) {
    try {
      inputs[toRelKey(f)] = sha256File(f);
    } catch {
      /* ignore unreadable files */
    }
  }
  let outputSha256 = "";
  try {
    outputSha256 = sha256File(OUT_JS);
  } catch {
    /* ignore */
  }
  const manifest: BuildManifest = { inputs, outputSha256 };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function isCacheValid(): { hit: boolean; reason: string } {
  if (!fs.existsSync(OUT_JS)) {
    return { hit: false, reason: "output file missing" };
  }

  const manifest = loadManifest();
  if (!manifest) {
    return { hit: false, reason: "no manifest found" };
  }

  const inputFiles = collectInputFiles();

  // Fast pre-check: compare file counts
  const manifestKeys = Object.keys(manifest.inputs);
  if (manifestKeys.length !== inputFiles.length) {
    return {
      hit: false,
      reason: `input file count changed (${manifestKeys.length} → ${inputFiles.length})`,
    };
  }

  // Hash each input and compare
  for (const f of inputFiles) {
    const key = toRelKey(f);
    const prevHash = manifest.inputs[key];
    if (prevHash === undefined) {
      return { hit: false, reason: `new input file: ${key}` };
    }
    let currentHash: string;
    try {
      currentHash = sha256File(f);
    } catch {
      return { hit: false, reason: `cannot read input: ${key}` };
    }
    if (currentHash !== prevHash) {
      return { hit: false, reason: `changed: ${key}` };
    }
  }

  // Verify output hash still matches
  let outHash: string;
  try {
    outHash = sha256File(OUT_JS);
  } catch {
    return { hit: false, reason: "output unreadable" };
  }
  if (outHash !== manifest.outputSha256) {
    return { hit: false, reason: "output file was modified externally" };
  }

  return { hit: true, reason: "all input hashes match manifest" };
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
if (!force) {
  const { hit, reason } = isCacheValid();
  if (hit) {
    const rel = path.relative(root, OUT_JS).replaceAll("\\", "/");
    console.log(
      `[build:selfhost-js] ✓ cache hit — ${rel} is up-to-date (${reason})`,
    );
    process.exit(0);
  } else {
    console.log(`[build:selfhost-js] cache miss — ${reason}, recompiling`);
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

// Write content-hash manifest so subsequent runs can detect cache hits reliably.
writeManifest(collectInputFiles());
const manifestRel = path.relative(root, MANIFEST_PATH).replaceAll("\\", "/");
console.log(`[build:selfhost-js] ✓ wrote manifest → ${manifestRel}`);

// Also sync to selfhost.generated.js so compiler.ts's backend:"selfhost" path stays current.
fs.copyFileSync(OUT_JS, GENERATED_JS);
const genRel = path.relative(root, GENERATED_JS).replaceAll("\\", "/");
console.log(`[build:selfhost-js] ✓ synced → ${genRel}`);

// Re-write manifest after sync: GENERATED_JS changed (it is one of the tracked inputs),
// so the manifest must reflect its new hash to avoid a spurious cache miss on the next run.
writeManifest(collectInputFiles());
console.log(`[build:selfhost-js] ✓ manifest updated after sync`);
