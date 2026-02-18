// @ts-nocheck
// Smoke test: generic Vec<T> via tuff_core::Vec module import
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileFileResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "vec-generic-smoke");
const appDir = path.join(outDir, "app");
const entry = path.join(appDir, "Main.tuff");
const outC = path.join(outDir, "main.c");
const outExe = path.join(
  outDir,
  process.platform === "win32" ? "main.exe" : "main",
);

fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(
  entry,
  [
    "let { Vec, Some } = tuff_core::Vec;",
    "fn main() : I32 => {",
    "  let maybe = Vec<I32>();",
    "  if (maybe is Some<Vec<I32>>) {",
    "    let unwrapped : Some<Vec<I32>> = maybe;",
    "    let v = unwrapped.field;",
    "    v.addLast(42);",
    "    v.addLast(99);",
    "    if (v.size() == 2USize) return 0;",
    "  }",
    "  1",
    "}",
    "",
  ].join("\n"),
  "utf8",
);

const result = compileFileResult(entry, outC, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: { moduleBaseDir: appDir },
});

if (!result.ok) {
  console.error("Vec generic module compile failed:", result.error.message);
  process.exit(1);
}

if (!result.value.c?.includes("int main(void)")) {
  console.error("Expected C output with main entrypoint");
  process.exit(1);
}

fs.writeFileSync(outC, result.value.c, "utf8");

const compilerCandidates =
  process.platform === "win32"
    ? ["gcc", "clang", "cc"]
    : ["clang", "cc", "gcc"];
const selected = compilerCandidates.find(
  (c) => spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0,
);

if (!selected) {
  console.warn("No C compiler found; skipping native run");
  console.log("Vec generic module compile OK");
  process.exit(0);
}

const compile = spawnSync(selected, [outC, "-O0", "-o", outExe], {
  encoding: "utf8",
});
if (compile.status !== 0) {
  console.error("C compile failed:", compile.stderr);
  process.exit(1);
}

const run = spawnSync(outExe, [], { encoding: "utf8" });
if (run.status !== 0) {
  console.error(
    `Expected exit 0, got ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}`,
  );
  process.exit(1);
}

console.log("Vec generic module smoke passed");
