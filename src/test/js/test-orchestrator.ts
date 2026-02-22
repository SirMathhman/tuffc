import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

type SuiteName = "core" | "native" | "stress";

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
    "./src/test/js/stage1-bootstrap.ts",
    "./src/test/js/phase3-stage2.ts",
    "./src/test/js/phase4-production.ts",
    "./src/test/js/borrow-checker.ts",
    "./src/test/js/contracts-static-dispatch.ts",
    "./src/test/js/destructor-semantics.ts",
    "./src/test/js/cli-hardening.ts",
    "./src/test/js/selfhost-test.ts",
    "./src/test/js/selfhost-modules.ts",
    "./src/test/js/selfhost-diagnostics.ts",
    "./src/test/js/selfhost-parity.ts",
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
      candidate !== "stress"
    ) {
      console.error(
        `Unknown suite '${candidate}'. Valid suites: core,native,stress`,
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

  const relative = path.relative(root, scriptPath).replaceAll("\\", "/");
  console.log(`\n[test] ▶ ${relative}`);

  const result = spawnSync(nodeExec, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error) {
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

const suites = parseSuites(process.argv.slice(2));
const updateSnapshots = process.argv.includes("--update");

const scriptsInOrder = suites.flatMap((suite) => suiteScripts[suite]);
const dedupedScripts = [...new Set(scriptsInOrder)];

if (dedupedScripts.length === 0) {
  console.error("No scripts selected for execution.");
  process.exit(1);
}

console.log(`[test] Running suites: ${suites.join(", ")}`);
console.log(`[test] Script count: ${dedupedScripts.length}`);

for (const script of dedupedScripts) {
  executeScript(script, updateSnapshots);
}

console.log(`\n[test] ✅ Completed suites: ${suites.join(", ")}`);
