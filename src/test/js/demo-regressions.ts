// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);
const nodeExec = getNodeExecPath();

function runScript(script: string, extraArgs: string[] = []): void {
  const result = spawnSync(nodeExec, [tsxCli, script, ...extraArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `[demo-regressions] failed running ${script}: ${result.error?.message ?? `exit ${result.status}`}`,
    );
    process.exit(result.status ?? 1);
  }
}

runScript(path.join(root, "scripts", "seed-demo-regressions-db.ts"));
runScript(path.join(root, "src", "test", "js", "db-test-cases.ts"), [
  "--backend=selfhost",
  "--category=migrated:demo-regressions",
]);

console.log("Demo regressions passed via DB-backed suite");
