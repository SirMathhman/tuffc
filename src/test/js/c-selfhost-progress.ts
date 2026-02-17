// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileFileResult } from "../../main/js/compiler.ts";

const MAX_HARNESS_TIMEOUT_MS = 15_000;

function nowMs() {
  return Date.now();
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)}MiB`;
}

function debugFile(label, filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.log(`[c-selfhost][debug] ${label}: missing (${filePath})`);
    return;
  }
  const stat = fs.statSync(filePath);
  console.log(
    `[c-selfhost][debug] ${label}: ${filePath} size=${formatBytes(stat.size)} mtime=${stat.mtime.toISOString()}`,
  );
}

function runStep(command, args, options = {}) {
  const started = nowMs();
  console.log(`[c-selfhost][debug] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  const elapsed = nowMs() - started;
  console.log(
    `[c-selfhost][debug] done: ${command} exit=${result.status} signal=${result.signal ?? "none"} ms=${elapsed}`,
  );
  if (result.error) {
    console.log(`[c-selfhost][debug] error: ${result.error.message}`);
  }
  return result;
}

function isSegfaultLikeRun(result) {
  const signal = result?.signal ?? null;
  const status = result?.status;

  if (signal === "SIGSEGV") {
    return true;
  }

  // POSIX shells commonly use 139 for SIGSEGV (128 + 11).
  if (status === 139) {
    return true;
  }

  // Windows access violation / segfault-style exit code.
  // 0xC0000005 = 3221225477 (sometimes surfaced as signed -1073741819).
  if (status === 3221225477 || status === -1073741819) {
    return true;
  }

  return false;
}

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const entry = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const outDir = path.join(root, "tests", "out", "c");
const outC = path.join(outDir, "selfhost.c");
const outObj = path.join(outDir, "selfhost.o");
const outHarness = path.join(outDir, "selfhost_harness.c");
const outExe = path.join(
  outDir,
  process.platform === "win32"
    ? `selfhost-${process.pid}.exe`
    : `selfhost-${process.pid}`,
);
const deepHarness = process.env.TUFF_C_SELFHOST_DEEP === "1";
const parsedTimeout = Number(process.env.TUFF_C_SELFHOST_TIMEOUT_MS ?? "");
const requestedTimeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : deepHarness
      ? 600000
      : 30000;
const runTimeoutMs = Math.min(requestedTimeoutMs, MAX_HARNESS_TIMEOUT_MS);
console.log(
  `[c-selfhost] deep mode=${deepHarness} env=${process.env.TUFF_C_SELFHOST_DEEP ?? "<unset>"}`,
);
console.log(`[c-selfhost] cwd=${process.cwd()}`);
console.log(`[c-selfhost] entry=${entry}`);
console.log(`[c-selfhost] outDir=${outDir}`);
console.log(`[c-selfhost] outC=${outC}`);
console.log(`[c-selfhost] outObj=${outObj}`);
console.log(`[c-selfhost] outHarness=${outHarness}`);
console.log(`[c-selfhost] outExe=${outExe}`);
console.log(`[c-selfhost] harness timeout=${runTimeoutMs}ms`);
if (runTimeoutMs < requestedTimeoutMs) {
  console.log(
    `[c-selfhost][debug] timeout clamped from ${requestedTimeoutMs}ms to ${MAX_HARNESS_TIMEOUT_MS}ms`,
  );
}

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

console.log(
  `[c-selfhost][debug] compile ok target=${compile.value?.target ?? "unknown"} outputPath=${compile.value?.outputPath ?? "<none>"}`,
);

if (!fs.existsSync(outC)) {
  console.error("Expected generated selfhost.c output file");
  process.exit(1);
}

debugFile("generated-c", outC);

console.log("[c-selfhost] selecting C compiler...");

const candidates =
  process.platform === "win32"
    ? ["clang", "gcc", "cc"]
    : ["cc", "clang", "gcc"];
let selected = undefined;
for (const candidate of candidates) {
  const check = runStep(candidate, ["--version"]);
  if (check.status === 0) {
    selected = candidate;
    const firstLine = (check.stdout ?? "").split(/\r?\n/)[0] ?? "";
    if (firstLine) {
      console.log(
        `[c-selfhost][debug] selected compiler version: ${firstLine}`,
      );
    }
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

const objectCompile = runStep(selected, [
  "-Dmain=selfhost_entry",
  "-c",
  outC,
  "-O0",
  "-o",
  outObj,
]);

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

debugFile("object", outObj);

const SELFHOST_ENTRY_DECL = `#include <stdio.h>

extern int64_t selfhost_entry(void);`;

const harnessSource = deepHarness
  ? `#include <stdint.h>
#include <inttypes.h>
#include <string.h>
#include <stdio.h>
${SELFHOST_ENTRY_DECL.split("\n").slice(2).join("\n")}
extern int64_t compile_source_with_options(int64_t source, int64_t strict_safety, int64_t lint_enabled, int64_t max_effective_lines, int64_t borrow_enabled, int64_t target);

int main(void) {
  fprintf(stderr, "[deep] calling selfhost_entry\\n");
  (void)selfhost_entry();
  fprintf(stderr, "[deep] selfhost_entry done\\n");
  const char* src = "fn main() : I32 => 7;";
  fprintf(stderr, "[deep] calling compile_source_with_options\\n");
  int64_t out = compile_source_with_options((int64_t)(intptr_t)src, 0, 0, 500, 1, (int64_t)(intptr_t)"js");
  fprintf(stderr, "[deep] compile_source_with_options returned\\n");
  const char* js = (const char*)(intptr_t)out;
  if (js == 0) return 2;
  if (strstr(js, "function main") == 0) return 3;
  fprintf(stderr, "[deep] deep harness success\\n");
  return 0;
}
`
  : `#include <stdint.h>

${SELFHOST_ENTRY_DECL.split("\n").slice(2).join("\n")}

int main(void) {
  return (int)selfhost_entry();
}
`;
fs.writeFileSync(outHarness, harnessSource, "utf8");
debugFile("harness-source", outHarness);

console.log("[c-selfhost] linking selfhost harness executable...");

const link = runStep(selected, [outObj, outHarness, "-O0", "-o", outExe]);

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

debugFile("linked-exe", outExe);

console.log("[c-selfhost] running harness executable...");
const run = runStep(outExe, [], {
  timeout: runTimeoutMs,
});

if (run.error) {
  console.error(`Harness run failed: ${run.error.message}`);
  if ((run.error.message ?? "").includes("ETIMEDOUT")) {
    console.error(
      `[c-selfhost][debug] harness exceeded timeout ${runTimeoutMs}ms (hard cap ${MAX_HARNESS_TIMEOUT_MS}ms)`,
    );
  }
  if (run.stdout || run.stderr) {
    console.error(run.stdout ?? "");
    console.error(run.stderr ?? "");
  }
  process.exit(1);
}

if (run.signal) {
  console.error(`Harness terminated by signal: ${run.signal}`);
  if (run.signal === "SIGSEGV") {
    console.error(
      "[c-selfhost][critical] Segmentation fault detected: generated C violated runtime safety assumptions. This indicates a compiler correctness/proof failure.",
    );
  }
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  process.exit(1);
}

if (run.status !== 0) {
  console.error(`Linked selfhost executable exited with ${run.status}`);
  if (isSegfaultLikeRun(run)) {
    console.error(
      "[c-selfhost][critical] Segmentation fault/access violation detected: generated C is unsound for this input and must be treated as a correctness proof failure.",
    );
  }
  console.error(run.stdout ?? "");
  console.error(run.stderr ?? "");
  if (run.status === 3221225786) {
    console.error(
      `[c-selfhost] exit 3221225786 (STATUS_CONTROL_C_EXIT) often indicates timeout/interrupt under heavy deep mode; current timeout=${runTimeoutMs}ms`,
    );
  }
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
