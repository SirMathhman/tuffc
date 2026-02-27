import fs from "node:fs";
import os from "node:os";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

type SuiteName = "core" | "native" | "stress" | "parity";
type ScriptOutcome = "passed" | "timed_out" | "failed";

const TEST_TIMEOUT_MS = 60_000;

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);
const nodeExec = getNodeExecPath();

const suiteScripts: Record<SuiteName, string[]> = {
  core: [
    "./src/test/js/db-test-cases.ts",
    "./src/test/js/db-multifile-smoke.ts",
    "./src/test/js/result-migration.ts",
    "./src/test/js/extern-source-attribution.ts",
    "./src/test/js/selfhost-c-empty-substrate.ts",
    "./src/test/js/runtime-prelude-from-tuff.ts",
    "./src/test/js/panic-module-stdlib-only.ts",
    "./src/test/js/io-module-stdlib-only.ts",
    "./src/test/js/collections-module-stdlib-only.ts",
    "./src/test/js/tuff-c-extern-sources-policy.ts",
    "./src/test/js/run-tests.ts",
    "./src/test/js/phase3-stage2.ts",
    "./src/test/js/phase4-production.ts",
    "./src/test/js/borrow-checker.ts",
    "./src/test/js/cli-hardening.ts",
    "./src/test/js/formatter.ts",
    "./src/test/js/tuff-target.ts",
    "./src/test/js/certificate.ts",
    "./src/test/js/cpd-tuff.ts",
    "./src/test/js/selfhost-test.ts",
    "./src/test/js/selfhost-modules.ts",
    "./src/test/js/selfhost-diagnostics.ts",
    "./src/test/js/stage-equivalence.ts",
  ],
  native: [
    "./src/test/js/c-backend-smoke.ts",
    "./src/test/js/monomorphization-plan.ts",
    "./src/test/js/c-native-cli-e2e.ts",
    "./src/test/js/c-selfhost-progress.ts",
    "./src/test/js/c-bootstrap-parity.ts",
  ],
  stress: [
    "./src/test/js/spec-semantics-exhaustive.ts",
    "./src/test/js/selfhost-stress.ts",
  ],
  parity: [
    "./src/test/js/contracts-static-dispatch.ts",
    "./src/test/js/selfhost-parity.ts",
  ],
};

function parseSuites(argv: string[]): SuiteName[] {
  const raw = argv.find((arg) => arg.startsWith("--suite="));
  if (!raw) return ["core"];

  const selected = raw
    .slice("--suite=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const suites: SuiteName[] = [];
  for (const candidate of selected) {
    if (
      candidate !== "core" &&
      candidate !== "native" &&
      candidate !== "stress" &&
      candidate !== "parity"
    ) {
      console.error(
        `Unknown suite '${candidate}'. Valid suites: core,native,stress,parity`,
      );
      process.exit(1);
    }
    suites.push(candidate);
  }

  return suites.length > 0 ? suites : ["core"];
}

function parseConcurrency(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--concurrency="));
  if (raw) {
    const n = parseInt(raw.slice("--concurrency=".length), 10);
    if (!isNaN(n) && n >= 1) return n;
  }
  // Default: min(cpu count, 4) — avoids spawning dozens of tsx processes on
  // high-core-count machines which causes I/O contention and slower overall runs.
  return Math.min(os.cpus().length, 4);
}

function buildScriptArgs(
  scriptPath: string,
  updateSnapshots: boolean,
): string[] {
  const args = [tsxCli, scriptPath];
  if (updateSnapshots && scriptPath.endsWith("run-tests.ts")) {
    args.push("--update");
  }
  if (scriptPath.endsWith("run-tests.ts")) {
    args.push("--backend=selfhost");
  }
  if (scriptPath.endsWith("db-test-cases.ts")) {
    args.push("--backend=selfhost", "--allow-known-gaps");
  }
  return args;
}

interface ScriptResult {
  script: string;
  outcome: ScriptOutcome;
  output: string;
  elapsedMs: number;
}

function executeScriptAsync(
  scriptPath: string,
  updateSnapshots: boolean,
): Promise<ScriptResult> {
  const args = buildScriptArgs(scriptPath, updateSnapshots);
  const relative = path.relative(root, scriptPath).replaceAll("\\", "/");
  const t0 = Date.now();

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    const proc = spawn(nodeExec, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({
        script: relative,
        outcome: "timed_out",
        output: Buffer.concat(chunks).toString("utf8"),
        elapsedMs: Date.now() - t0,
      });
    }, TEST_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const elapsed = Date.now() - t0;
      const output = Buffer.concat(chunks).toString("utf8");
      resolve({
        script: relative,
        outcome: code === 0 ? "passed" : "failed",
        output,
        elapsedMs: elapsed,
      });
    });
  });
}

async function runScriptsParallel(
  scripts: string[],
  updateSnapshots: boolean,
  concurrency: number,
): Promise<ScriptResult[]> {
  const results: ScriptResult[] = [];
  const queue = [...scripts];
  let active = 0;
  let resolveAll!: () => void;
  const done = new Promise<void>((res) => {
    resolveAll = res;
  });

  function dispatch(): void {
    while (active < concurrency && queue.length > 0) {
      const script = queue.shift()!;
      active++;
      const relative = path.relative(root, script).replaceAll("\\", "/");
      console.log(`\n[test] ▶ ${relative} (starting)`);
      executeScriptAsync(script, updateSnapshots).then((result) => {
        results.push(result);
        active--;
        // Print buffered output now that this script finished
        if (result.output.trim().length > 0) {
          process.stdout.write(result.output);
        }
        const icon =
          result.outcome === "passed"
            ? "✓"
            : result.outcome === "timed_out"
              ? "⚠"
              : "✖";
        console.log(`[test] ${icon} ${result.script} (${result.elapsedMs}ms)`);
        dispatch();
        if (active === 0 && queue.length === 0) resolveAll();
      });
    }
    if (active === 0 && queue.length === 0) resolveAll();
  }

  dispatch();
  await done;
  return results;
}

function ensureSelfhostBuiltOnceAtStart(): void {
  const buildScript = path.join(root, "scripts", "build-selfhost-js.ts");
  const relative = path.relative(root, buildScript).replaceAll("\\", "/");
  console.log(`\n[test] ▶ build-once: ${relative}`);

  const result = spawnSync(nodeExec, [tsxCli, buildScript], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error != null) {
    throw new Error(
      `[test] Failed to start build step ${relative}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    console.error(
      `[test] ✖ build step ${relative} exited with status ${result.status}`,
    );
    process.exit(result.status ?? 1);
  }

  console.log(`[test] ✓ build-once complete`);
}

const suites = parseSuites(process.argv.slice(2));
const updateSnapshots = process.argv.includes("--update");
const concurrency = parseConcurrency(process.argv.slice(2));

const scriptsInOrder = suites.flatMap((suite) => suiteScripts[suite]);
const dedupedScripts = [...new Set(scriptsInOrder)];

if (dedupedScripts.length === 0) {
  console.error("No scripts selected for execution.");
  process.exit(1);
}

// Suites that require the selfhost JS build artifact
const selfhostSuites: SuiteName[] = ["core", "stress", "parity"];
const needsSelfhostArtifact = suites.some((s) => selfhostSuites.includes(s));

if (needsSelfhostArtifact) {
  ensureSelfhostBuiltOnceAtStart();

  const exeArtifact = path.join(
    root,
    "tests",
    "out",
    "c-bootstrap",
    process.platform === "win32"
      ? "stage3_selfhost_cli.exe"
      : "stage3_selfhost_cli",
  );
  const jsArtifact = path.join(root, "tests", "out", "build", "selfhost.js");
  const missing = [exeArtifact, jsArtifact].filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    console.error("[test] Missing build artifacts:");
    for (const p of missing) {
      console.error(`  ${path.relative(root, p).replaceAll("\\", "/")}`);
    }
    console.error("[test] Run 'npm run build' first.");
    process.exit(1);
  }
}

console.log(
  `[test] Script count: ${dedupedScripts.length}, concurrency: ${concurrency} (use --concurrency=N to override)`,
);

// When updating snapshots, serialize execution to avoid concurrent file writes.
const effectiveConcurrency = updateSnapshots ? 1 : concurrency;

const results = await runScriptsParallel(
  dedupedScripts,
  updateSnapshots,
  effectiveConcurrency,
);

const timedOutScripts = results
  .filter((r) => r.outcome === "timed_out")
  .map((r) => r.script);
const failedScripts = results
  .filter((r) => r.outcome === "failed")
  .map((r) => r.script);

if (timedOutScripts.length > 0) {
  console.error("\n[test] Timed out script(s):");
  for (const script of timedOutScripts) {
    console.error(`  ${script}`);
  }
}

if (failedScripts.length > 0) {
  console.error("\n[test] Failed script(s):");
  for (const script of failedScripts) {
    console.error(`  ${script}`);
  }
  process.exit(1);
}

if (timedOutScripts.length > 0) {
  process.exit(124);
}

console.log(`\n[test] ✅ Completed suites: ${suites.join(", ")}`);
