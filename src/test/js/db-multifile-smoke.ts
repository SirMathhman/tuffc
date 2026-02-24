// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const nodeExec = getNodeExecPath();
const tsxCli = getTsxCliPath(root);

function run(script: string, args: string[] = []): void {
  const result = spawnSync(nodeExec, [tsxCli, script, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `[db-multifile-smoke] failed running ${script}: ${result.error?.message ?? `exit ${result.status}`}`,
    );
    process.exit(result.status ?? 1);
  }
}

run(path.join(root, "scripts", "seed-db-multifile-smoke.ts"));
run(path.join(root, "src", "test", "js", "db-test-cases.ts"), [
  "--backend=selfhost",
  "--category=migrated:multi-file-smoke",
]);

console.log("DB multi-file smoke test passed");
