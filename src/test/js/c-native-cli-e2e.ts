import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getRepoRootFromImportMeta, getTsxCliPath } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);

const hasCompiler = (() => {
  const candidates =
    process.platform === "win32"
      ? ["clang", "gcc", "cc"]
      : ["clang", "cc", "gcc"];
  for (const c of candidates) {
    const probe = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return true;
  }
  return false;
})();

if (!hasCompiler) {
  console.warn("No C compiler available for native CLI e2e check; skipping.");
  process.exit(0);
}

const outDir = path.join(root, "tests", "out", "c-native-cli-e2e");
fs.mkdirSync(outDir, { recursive: true });

const cOut = path.join(outDir, "factorial.c");
const exeOut = path.join(
  outDir,
  process.platform === "win32" ? "factorial.exe" : "factorial",
);

const compile = spawnSync(
  process.execPath,
  [
    tsxCli,
    "./src/main/js/cli.ts",
    "./src/test/tuff/cases/factorial.tuff",
    "--target",
    "c",
    "--native",
    "-o",
    cOut,
    "--native-out",
    exeOut,
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (compile.status !== 0) {
  const combined = `${compile.stdout ?? ""}\n${compile.stderr ?? ""}`;
  console.error("Native CLI compile/link failed:");
  console.error(combined);
  process.exit(1);
}

if (!fs.existsSync(exeOut)) {
  console.error(`Expected native executable at ${exeOut}`);
  process.exit(1);
}

const run = spawnSync(exeOut, [], { cwd: root, encoding: "utf8" });
if (run.status !== 120) {
  console.error(`Expected native executable exit code 120, got ${run.status}`);
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  process.exit(1);
}

console.log("Native CLI C e2e passed");
