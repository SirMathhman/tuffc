import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

type SuiteName = "core" | "native" | "stress" | "parity";

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);
const nodeExec = getNodeExecPath();

const suiteScripts: Record<SuiteName, string[]> = {
  core: [
    "./src/test/js/db-test-cases.ts",
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
    "./src/test/js/certificate.ts",
    "./src/test/js/cpd-tuff.ts",
    "./src/test/js/selfhost-test.ts",
    "./src/test/js/selfhost-modules.ts",
    "./src/test/js/selfhost-diagnostics.ts",
    "./src/test/js/stage-equivalence.ts",
    "./src/test/js/demo-regressions.ts",
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

function executeScript(scriptPath: string, updateSnapshots: boolean): void {
  const args = [tsxCli, scriptPath];
  if (updateSnapshots && scriptPath.endsWith("run-tests.ts")) {
    args.push("--update");
  }
  if (scriptPath.endsWith("run-tests.ts")) {
    args.push("--backend=selfhost");
  }
  if (scriptPath.endsWith("db-test-cases.ts")) {
    args.push("--backend=native-exe", "--allow-known-gaps");
  }

  const relative = path.relative(root, scriptPath).replaceAll("\\", "/");
  console.log(`\n[test] ▶ ${relative}`);

  const result = spawnSync(nodeExec, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error != null) {
    console.error(
      `[test] Failed to start ${relative}: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[test] ✖ ${relative} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log(`[test] ✓ ${relative}`);
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
    console.error(
      `[test] Failed to start build step ${relative}: ${result.error.message}`,
    );
    process.exit(1);
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

console.log(`[test] Script count: ${dedupedScripts.length}`);

for (const script of dedupedScripts) {
  executeScript(script, updateSnapshots);
}

console.log(`\n[test] ✅ Completed suites: ${suites.join(", ")}`);
