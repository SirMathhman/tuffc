// @ts-nocheck
import path from "node:path";
import {
  getRepoRootFromImportMeta,
  runTestScript,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const LABEL = "db-multifile-smoke";

runTestScript(LABEL, root, path.join(root, "scripts", "seed-db-multifile-smoke.ts"));
runTestScript(LABEL, root, path.join(root, "src", "test", "js", "db-test-cases.ts"), [
  "--backend=selfhost",
  "--category=migrated:multi-file-smoke",
]);

console.log("DB multi-file smoke test passed");
