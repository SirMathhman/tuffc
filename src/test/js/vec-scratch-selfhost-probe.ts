// @ts-nocheck
// Delegates to vec-scratch-probe.ts with --selfhost flag.
// Run: npx tsx ./src/test/js/vec-scratch-probe.ts --selfhost
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const probe = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "vec-scratch-probe.ts",
);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx/esm", probe, "--selfhost"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
