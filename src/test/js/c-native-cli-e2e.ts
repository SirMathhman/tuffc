import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getNativeCliWrapperPath,
  getNodeExecPath,
  getRepoRootFromImportMeta,
  selectCCompiler,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const nodeExec = getNodeExecPath();
const nativeCli = getNativeCliWrapperPath(root);

const COMPILER = selectCCompiler("[c-native-cli-e2e] ");
if (!COMPILER) {
  console.error("No C compiler available for native CLI e2e check.");
  console.error(
    "Install clang or gcc and ensure it is available on PATH before running native tiers.",
  );
  process.exit(1);
}

const outDir = path.join(root, "tests", "out", "c-native-cli-e2e");
fs.mkdirSync(outDir, { recursive: true });

const cOut = path.join(outDir, "factorial.c");
const exeOut = path.join(
  outDir,
  process.platform === "win32" ? "factorial.exe" : "factorial",
);

const compile = spawnSync(
  nodeExec,
  [
    nativeCli,
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
  const cc = COMPILER;
  if (!cc) {
    console.error(
      `Expected native executable at ${exeOut}, and no C compiler found for fallback link`,
    );
    process.exit(1);
  }

  const link = spawnSync(cc, [cOut, "-O0", "-o", exeOut], {
    cwd: root,
    encoding: "utf8",
  });
  if (link.status !== 0 || !fs.existsSync(exeOut)) {
    const combined = `${link.stdout ?? ""}\n${link.stderr ?? ""}`;
    console.error("Native CLI produced C output, but fallback link failed:");
    console.error(combined);
    process.exit(1);
  }
}

const run = spawnSync(exeOut, [], { cwd: root, encoding: "utf8" });
if (run.status !== 120) {
  console.error(`Expected native executable exit code 120, got ${run.status}`);
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  process.exit(1);
}

console.log("Native CLI C e2e passed");
