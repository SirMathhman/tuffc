/**
 * watch.ts — development watch mode for selfhost.tuff
 *
 * Watches src/main/tuff/ and src/main/tuff-core/ for .tuff file changes and
 * triggers an incremental rebuild (build-selfhost-js.ts) on each change.
 *
 * The SHA-256 manifest cache in build-selfhost-js.ts ensures that only genuine
 * content changes trigger a full recompile; touch-without-edit is a no-op.
 *
 * Usage:
 *   npx tsx ./scripts/watch.ts
 *   npx tsx ./scripts/watch.ts --force   # force initial rebuild even if cached
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const force = process.argv.includes("--force");

const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const buildScript = path.join(root, "scripts", "build-selfhost-js.ts");

const WATCH_DIRS = [
  path.join(root, "src", "main", "tuff"),
  path.join(root, "src", "main", "tuff-core"),
];

const DEBOUNCE_MS = 300;

// ── Build runner ─────────────────────────────────────────────────────────────

let buildPending = false;
let buildRunning = false;

function runBuild(changedFile?: string): void {
  if (buildRunning) {
    buildPending = true;
    return;
  }

  buildRunning = true;
  const label = changedFile
    ? path.relative(root, changedFile).replaceAll("\\", "/")
    : "initial";

  console.log(`\n[watch] 🔨 rebuilding — triggered by: ${label}`);
  const t0 = Date.now();

  const args = [tsxCli, buildScript];
  if (force && !changedFile) {
    // Only pass --force on the very first build if requested
    args.push("--force");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    timeout: 300_000,
  });

  const elapsed = Date.now() - t0;

  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    console.error(
      `[watch] ❌ build error after ${elapsed}ms: ${err.message}`,
    );
  } else if (result.status !== 0) {
    console.error(
      `[watch] ❌ build failed after ${elapsed}ms (exit ${String(result.status)})`,
    );
  } else {
    console.log(`[watch] ✅ build succeeded in ${elapsed}ms`);
  }

  buildRunning = false;

  if (buildPending) {
    buildPending = false;
    runBuild(undefined);
  }
}

// ── Debouncer ─────────────────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingChangedFile: string | undefined;

function scheduleBuild(changedFile: string): void {
  pendingChangedFile = changedFile;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const file = pendingChangedFile;
    pendingChangedFile = undefined;
    runBuild(file);
  }, DEBOUNCE_MS);
}

// ── Watcher setup ─────────────────────────────────────────────────────────────

function startWatching(): void {
  for (const dir of WATCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    try {
      fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (!filename?.endsWith(".tuff")) return;
        const fullPath = path.join(dir, filename);
        scheduleBuild(fullPath);
      });
      console.log(
        `[watch] 👁  watching ${path.relative(root, dir).replaceAll("\\", "/")}`,
      );
    } catch (err) {
      console.warn(
        `[watch] ⚠  could not watch ${dir}: ${(err as Error).message}`,
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`[watch] Tuff source watcher starting`);
console.log(`[watch] Debounce: ${DEBOUNCE_MS}ms | Press Ctrl+C to stop`);

startWatching();

// Run an initial build to ensure the artifact is fresh before watching
runBuild();

process.on("SIGINT", () => {
  console.log("\n[watch] Stopped.");
  process.exit(0);
});
