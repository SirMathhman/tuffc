// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileFileResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const entry = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const outDir = path.join(root, "tests", "out", "c");
const outC = path.join(outDir, "selfhost.c");
const outObj = path.join(outDir, "selfhost.o");
const outHarness = path.join(outDir, "selfhost_harness.c");
const outExe = path.join(
  outDir,
  process.platform === "win32" ? "selfhost.exe" : "selfhost",
);
const runtimeDir = path.join(root, "src", "main", "c");
const runtimeSource = path.join(runtimeDir, "tuff_runtime.c");
const deepHarness = process.env.TUFF_C_SELFHOST_DEEP === "1";
console.log(
  `[c-selfhost] deep mode=${deepHarness} env=${process.env.TUFF_C_SELFHOST_DEEP ?? "<unset>"}`,
);

fs.mkdirSync(outDir, { recursive: true });

console.log("[c-selfhost] generating selfhost.c via Stage0 target=c...");

const compile = compileFileResult(entry, outC, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: { moduleBaseDir: path.dirname(entry) },
  lint: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!compile.ok) {
  console.error("Failed to compile selfhost.tuff to C:");
  console.error(compile.error.message);
  process.exit(1);
}

if (!fs.existsSync(outC)) {
  console.error("Expected generated selfhost.c output file");
  process.exit(1);
}

console.log("[c-selfhost] selecting C compiler...");

const candidates =
  process.platform === "win32"
    ? ["clang", "gcc", "cc"]
    : ["cc", "clang", "gcc"];
let selected = undefined;
for (const candidate of candidates) {
  const check = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  if (check.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  console.warn(
    "No C compiler found (clang/gcc/cc). Skipping object compile check.",
  );
  console.log(`Generated ${outC}`);
  process.exit(0);
}

const objectCompile = spawnSync(
  selected,
  ["-Dmain=selfhost_entry", "-c", outC, "-I", runtimeDir, "-O0", "-o", outObj],
  { encoding: "utf8" },
);

if (objectCompile.error) {
  console.error(
    `Object compile failed to start: ${objectCompile.error.message}`,
  );
  process.exit(1);
}

if (objectCompile.status !== 0) {
  console.error(
    `Failed to compile generated selfhost.c to object with ${selected}`,
  );
  console.error(objectCompile.stdout ?? "");
  console.error(objectCompile.stderr ?? "");
  process.exit(1);
}

const harnessSource = deepHarness
  ? `#include <stdint.h>
#include <inttypes.h>
#include <string.h>
#include <stdio.h>

extern int64_t selfhost_entry(void);
extern int64_t compile_source_with_options(int64_t source, int64_t strict_safety, int64_t lint_enabled, int64_t max_effective_lines);

int main(void) {
  fprintf(stderr, "[deep] calling selfhost_entry\\n");
  (void)selfhost_entry();
  fprintf(stderr, "[deep] selfhost_entry done\\n");
  const char* src = "fn main() : I32 => 7;";
  fprintf(stderr, "[deep] calling compile_source_with_options\\n");
  int64_t out = compile_source_with_options((int64_t)(intptr_t)src, 0, 0, 500);
  fprintf(stderr, "[deep] compile_source_with_options returned\\n");
  const char* js = (const char*)(intptr_t)out;
  if (js == 0) return 2;
  if (strstr(js, "function main") == 0) return 3;
  fprintf(stderr, "[deep] deep harness success\\n");
  return 0;
}
`
  : `#include <stdint.h>

extern int64_t selfhost_entry(void);

int main(void) {
  return (int)selfhost_entry();
}
`;
fs.writeFileSync(outHarness, harnessSource, "utf8");

console.log("[c-selfhost] linking selfhost harness executable...");

const link = spawnSync(
  selected,
  [outObj, outHarness, runtimeSource, "-I", runtimeDir, "-O0", "-o", outExe],
  { encoding: "utf8" },
);

if (link.error) {
  console.error(`Link failed to start: ${link.error.message}`);
  process.exit(1);
}

if (link.status !== 0) {
  console.error(
    `Failed to link generated selfhost C executable with ${selected}`,
  );
  console.error(link.stdout ?? "");
  console.error(link.stderr ?? "");
  process.exit(1);
}

console.log("[c-selfhost] running harness executable...");
const run = spawnSync(outExe, [], {
  encoding: "utf8",
  timeout: deepHarness ? 120000 : 30000,
});

if (run.error) {
  console.error(`Harness run failed: ${run.error.message}`);
  process.exit(1);
}

if (run.signal) {
  console.error(`Harness terminated by signal: ${run.signal}`);
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  process.exit(1);
}

if (run.status !== 0) {
  console.error(`Linked selfhost executable exited with ${run.status}`);
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  process.exit(1);
}

if (!deepHarness) {
  const combined = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  if (!combined.includes("Self-hosted Tuff compiler loaded")) {
    console.error(
      "Expected startup output to include 'Self-hosted Tuff compiler loaded'",
    );
    console.error(combined);
    process.exit(1);
  }
}

console.log(
  `Selfhost C progress check passed with ${selected} (object+link+harness run)`,
);
