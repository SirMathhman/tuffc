// @ts-nocheck
import path from "node:path";
import { getRepoRootFromImportMeta, runTestScript } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const LABEL = "demo-regressions";

runTestScript(
  LABEL,
  root,
  path.join(root, "scripts", "seed-demo-regressions-db.ts"),
);
runTestScript(
  LABEL,
  root,
  path.join(root, "src", "test", "js", "db-test-cases.ts"),
  ["--backend=selfhost", "--category=migrated:demo-regressions"],
);

console.log("Demo regressions passed via DB-backed suite");
