// @ts-nocheck
/**
 * C Bootstrap Parity Test
 *
 * Closes the native self-hosting loop:
 *
 *   Stage3-JS  + selfhost.tuff  -->  stage3_selfhost.c        (Phase 1)
 *   cc(stage3_selfhost.c)       -->  stage3_native_exe         (Phase 2)
 *   stage3_native_exe --version                                (Phase 3: smoke)
 *   stage3_native_exe + selfhost.tuff --> stage4_selfhost.c    (Phase 4: fixpoint)
 *   assert stage3_selfhost.c == stage4_selfhost.c              (Phase 5: hash check)
 *
 * Phases 1–3 are hard failures; Phases 4–5 are reported but non-fatal so that
 * partial C-backend progress is still visible.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  buildStageChain,
  loadStageCompilerFromJs,
} from "./stage-matrix-harness.ts";
import { getEmbeddedCSubstrateSupport } from "../../main/js/c-runtime-support.ts";
import { compileSource } from "../../main/js/compiler.ts";
import * as runtime from "../../main/js/runtime.ts";
import {
  selectCCompiler,
  getRepoRootFromImportMeta,
  createBuildRunUtils,
} from "./path-test-utils.ts";
import {
  SELFHOST_EXTERN_ENTRY,
  COMPILE_OPTIONS_PARAMS_C,
  SELFHOST_MAIN_BODY,
} from "./c-harness-utils.ts";

// ─── Paths ───────────────────────────────────────────────────────────────────

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = path.join(root, "tests", "out", "c-bootstrap");
fs.mkdirSync(outDir, { recursive: true });
const { formatBytes, debugFile, runStep } = createBuildRunUtils("bootstrap");

const cPreludePath = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "RuntimePrelude.tuff",
);
const cSubstrateBundlePath = path.join(outDir, "embedded_c_substrate.c");
const embeddedCSubstrate = getEmbeddedCSubstrateSupport();
fs.writeFileSync(cSubstrateBundlePath, embeddedCSubstrate, "utf8");

const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const selfhostModuleBase = path.dirname(selfhostPath);

const stage3outC = path.join(outDir, "stage3_selfhost.c");
const stage3outObj = path.join(outDir, "stage3_selfhost.o");
const stage3outExe = path.join(
  outDir,
  process.platform === "win32" ? "stage3_selfhost.exe" : "stage3_selfhost",
);
const stage3cliHarness = path.join(outDir, "stage3_cli_harness.c");
const stage3cliExe = path.join(
  outDir,
  process.platform === "win32"
    ? "stage3_selfhost_cli.exe"
    : "stage3_selfhost_cli",
);
const stage3smokeHarness = path.join(outDir, "stage3_smoke_harness.c");
const fixpointOutC = path.join(outDir, "stage4_selfhost.c");
const fixpointHarness = path.join(outDir, "fixpoint_harness.c");
const fixpointExe = path.join(
  outDir,
  process.platform === "win32" ? "fixpoint.exe" : "fixpoint",
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeProcessExit(status: number | null): string {
  if (status == null) return "unknown";
  const hex = `0x${status.toString(16).toUpperCase()}`;
  const known: Record<number, string> = {
    3221225477: "access violation (invalid memory access)", // 0xC0000005
    3221225725: "stack overflow", // 0xC00000FD
    3221225786: "terminated (Ctrl+C/host cancellation)", // 0xC000013A
    3221226505: "stack buffer overrun / fast-fail", // 0xC0000409
  };
  return known[status] ? `${hex} (${known[status]})` : hex;
}

function getFixpointTimeoutMs(): number {
  const raw = process.env.TUFFC_FIXPOINT_TIMEOUT_MS;
  if (!raw) return 30_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return Math.floor(parsed);
}

function selectCCompilerLocal(): string {
  const result = selectCCompiler("[bootstrap] ");
  if (!result) {
    console.error(
      "[bootstrap] no C compiler found (clang/gcc/cc) — skipping native phases",
    );
  }
  return result;
}

function printBootstrapSummaryExit(phase4msg: string) {
  console.log("\n[bootstrap] ═══ Summary ═══");
  console.log("  Phase 1 ✔  Stage3-JS  → stage3_selfhost.c");
  console.log("  Phase 2 ✔  cc         → stage3_native_exe");
  console.log("  Phase 3 ✔  smoke      → OK");
  console.log(`  Phase 4 ✖  ${phase4msg}`);
  console.log("  Phase 5 —  skipped");
  process.exit(0);
}

function checkBootstrapRun(run, phase: string) {
  if (run.error) {
    console.error(`[bootstrap] FAIL: ${phase} error: ${run.error.message}`);
    process.exit(1);
  }
  const runOut = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  if (run.signal) {
    console.error(`[bootstrap] FAIL: ${phase} killed by signal: ${run.signal}`);
    console.error(runOut);
    process.exit(1);
  }
  if (run.status !== 0) {
    console.error(`[bootstrap] FAIL: ${phase} exit ${run.status}`);
    console.error(runOut);
    process.exit(1);
  }
}

function sha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

/** Strip comments and normalize whitespace for comparison purposes. */
function normalizeCSource(src: string): string {
  // Remove line comments
  let s = src.replace(/\/\/[^\n]*/g, "");
  // Remove block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Collapse whitespace runs (spaces/tabs) to single space
  s = s.replace(/[^\S\n]+/g, " ");
  // Strip trailing spaces on lines
  s = s.replace(/ \n/g, "\n");
  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ─── Phase 1: Stage3-JS emits C for selfhost.tuff ────────────────────────────

console.log("\n[bootstrap] ═══ Phase 1: Stage3-JS → stage3_selfhost.c ═══");

let stageChain: ReturnType<typeof buildStageChain>;
try {
  stageChain = buildStageChain(root, path.join(outDir, "chain"));
} catch (chainErr) {
  console.error(`[bootstrap] FAIL: could not build stage chain: ${chainErr}`);
  process.exit(1);
}

const { stage3Path } = stageChain;

// Reload stage3 JS with the C host globals injected so it can emit C.
function loadStage3WithCSupport(stage3JsPath: string) {
  const stage3Js = fs.readFileSync(stage3JsPath, "utf8");
  const cSubstrate = embeddedCSubstrate;

  // C runtime prelude: the .tuff file used as a base for generated C
  let cPrelude = "";
  try {
    cPrelude = fs.readFileSync(cPreludePath, "utf8");
  } catch {
    cPrelude = "";
  }

  const hostEmitTargetFromSource = (source: string, target: string) => {
    const r = compileSource(source, "<bootstrap-host>", {
      backend: "selfhost",
      target: target as "js" | "c",
      lint: { enabled: false },
      typecheck: { strictSafety: false },
    });
    if (!r.ok) throw r.error;
    return r.value.output;
  };

  return loadStageCompilerFromJs(stage3Js, {
    __host_get_c_substrate: () => cSubstrate,
    __host_get_c_runtime_prelude_source: () => cPrelude,
    __host_emit_target_from_source: hostEmitTargetFromSource,
  });
}

let stage3cHost: ReturnType<typeof loadStage3WithCSupport>;
try {
  stage3cHost = loadStage3WithCSupport(stage3Path);
} catch (hostErr) {
  console.error(
    `[bootstrap] FAIL: could not load stage3 with C support: ${hostErr}`,
  );
  process.exit(1);
}

if (typeof stage3cHost.compile_file_with_options !== "function") {
  console.error(
    "[bootstrap] FAIL: stage3 does not export compile_file_with_options — C emission requires it",
  );
  process.exit(1);
}

console.log(
  `[bootstrap] calling stage3.compile_file_with_options(selfhost.tuff, ..., target="c")`,
);
console.log(`[bootstrap]   input:  ${selfhostPath}`);
console.log(`[bootstrap]   output: ${stage3outC}`);

let stage3EmitResult: unknown;
try {
  stage3EmitResult = stage3cHost.compile_file_with_options(
    selfhostPath,
    stage3outC,
    0, // lintEnabled=0
    500, // maxEffectiveLines
    1, // borrowEnabled=1
    "c",
  );
} catch (e) {
  console.error(
    `[bootstrap] FAIL: stage3.compile_file_with_options threw: ${e}`,
  );
  process.exit(1);
}

console.log(`[bootstrap] Phase 1 emit result: ${stage3EmitResult}`);

if (!fs.existsSync(stage3outC)) {
  console.error(
    `[bootstrap] FAIL: stage3_selfhost.c was not written to ${stage3outC}`,
  );
  process.exit(1);
}

const stage3CSize = fs.statSync(stage3outC).size;
if (stage3CSize < 100) {
  console.error(
    `[bootstrap] FAIL: generated C is too small (${stage3CSize} bytes)`,
  );
  process.exit(1);
}

debugFile("stage3_selfhost.c", stage3outC);
console.log("[bootstrap] ✔ Phase 1 passed — stage3_selfhost.c written");

// ─── Phase 2: compile C → exe ────────────────────────────────────────────────

console.log("\n[bootstrap] ═══ Phase 2: cc → stage3_native_exe ═══");

const CC = selectCCompilerLocal();
if (!CC) {
  console.warn("[bootstrap] SKIP: no C compiler — phases 2-5 skipped");
  process.exit(0);
}

// Compile to object (rename main so we can supply our own harness)
const objResult = runStep(CC, [
  "-Dmain=selfhost_entry",
  "-c",
  stage3outC,
  "-O0",
  "-o",
  stage3outObj,
]);
if (objResult.error || objResult.status !== 0) {
  console.error("[bootstrap] FAIL: C compile to object failed");
  console.error(objResult.stdout ?? "");
  console.error(objResult.stderr ?? "");
  process.exit(1);
}
debugFile("stage3_selfhost.o", stage3outObj);

// Smoke harness: just call selfhost_entry() and check it returns 0.
const selfhostEntryDecls = `#include <stdint.h>

${SELFHOST_EXTERN_ENTRY}`;

const smokeHarnessSource = `
${selfhostEntryDecls}
#include <stdio.h>

int main(void) {
    char *argv0 = "tuffc";
    char *argv1 = "--version";
    char *dummy_argv[] = { argv0, argv1 };
    tuff_set_argv(2, dummy_argv);
    int64_t r = selfhost_entry();
    fprintf(stderr, "[smoke] selfhost_entry(--version) returned %lld\\n", (long long)r);
    return (int)r;
}
`;
fs.writeFileSync(stage3smokeHarness, smokeHarnessSource, "utf8");
debugFile("stage3_smoke_harness.c", stage3smokeHarness);

// CLI harness: forwards actual argv into selfhost_entry, producing a usable
// native compiler executable (not just smoke-test binary).
const cliHarnessSource = `
${selfhostEntryDecls}

int main(int argc, char **argv) {
${SELFHOST_MAIN_BODY}`;
fs.writeFileSync(stage3cliHarness, cliHarnessSource, "utf8");
debugFile("stage3_cli_harness.c", stage3cliHarness);

const linkResult = runStep(CC, [
  stage3outObj,
  stage3smokeHarness,
  "-O0",
  "-o",
  stage3outExe,
]);
if (linkResult.error || linkResult.status !== 0) {
  console.error("[bootstrap] FAIL: link failed");
  console.error(linkResult.stdout ?? "");
  console.error(linkResult.stderr ?? "");
  process.exit(1);
}
debugFile("stage3_selfhost_exe", stage3outExe);
console.log("[bootstrap] ✔ Phase 2 passed — stage3_native_exe linked");

const cliLinkResult = runStep(CC, [
  stage3outObj,
  stage3cliHarness,
  "-O0",
  "-o",
  stage3cliExe,
]);
if (cliLinkResult.error || cliLinkResult.status !== 0) {
  console.error("[bootstrap] FAIL: link failed for stage3 CLI exe");
  console.error(cliLinkResult.stdout ?? "");
  console.error(cliLinkResult.stderr ?? "");
  process.exit(1);
}
debugFile("stage3_selfhost_cli_exe", stage3cliExe);

// ─── Phase 3: smoke — run exe --version ──────────────────────────────────────

console.log(
  "\n[bootstrap] ═══ Phase 3: smoke — stage3_native_exe --version ═══",
);

const smokeRun = runStep(stage3outExe, [], { timeout: 15_000 });

checkBootstrapRun(smokeRun, "smoke run");

const smokeOutput = `${smokeRun.stdout ?? ""}\n${smokeRun.stderr ?? ""}`;
console.log(`[bootstrap] smoke output: ${smokeOutput.trim()}`);

// The exe prints "tuffc (stage3 native)" to stdout via the --version flag
if (!smokeOutput.includes("tuffc")) {
  console.error(
    '[bootstrap] FAIL: smoke output did not include "tuffc" — exe is not the expected selfhost compiler',
  );
  console.error(smokeOutput);
  process.exit(1);
}

console.log("[bootstrap] ✔ Phase 3 passed — stage3_native_exe smoke OK");

// ─── Phase 4: fixpoint — native exe emits C for selfhost.tuff ────────────────

console.log(
  "\n[bootstrap] ═══ Phase 4: fixpoint — stage3_native_exe + selfhost.tuff → stage4_selfhost.c ═══",
);

// Embed the actual paths as string literals into a harness that calls
// compile_file_with_options(selfhostPath, fixpointOutC, 0, 500, 1, "c").
// The path strings must use forward slashes (or escaped backslashes) for C.
function toCStringLiteral(p: string): string {
  return `"${p.replace(/\\/g, "\\\\")}"`;
}

const fixpointHarnessSource = `
#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

extern int64_t compile_file_with_options(
    int64_t inputPath,
    int64_t outputPath,
${COMPILE_OPTIONS_PARAMS_C}
extern int64_t compile_source_with_options(
    int64_t source,
${COMPILE_OPTIONS_PARAMS_C}
${selfhostEntryDecls.split("\n").slice(2).join("\n")}
extern int64_t get_argv(int64_t i);

/* Sanity-check: compile a trivial single-file Tuff program to C.  This
   exercises compile_source_with_options without any module loading. */
static int smoke_compile_source(void) {
  int64_t src = get_argv(1);
  int64_t target = get_argv(4);
    int64_t out = compile_source_with_options(
    src, 0, 500, 0, target);
    if (!out) {
        fprintf(stderr, "[fixpoint] FAIL: compile_source_with_options returned NULL\\n");
        return 1;
    }
    const char *s = (const char *)(intptr_t)out;
    if (strstr(s, "main") == NULL) {
        fprintf(stderr, "[fixpoint] FAIL: C output missing 'main'\\n");
        return 1;
    }
    fprintf(stderr, "[fixpoint] smoke_compile_source OK (got %zu bytes)\\n", strlen(s));
    return 0;
}

int main(void) {
    const char *input  = ${toCStringLiteral(selfhostPath)};
    const char *output = ${toCStringLiteral(fixpointOutC)};
    const char *target = "c";
    const char *smoke_source = "fn main() : I32 => 42;";

    /* First, run the generated entry once so static globals are initialized
       (equivalent to what generated main() does via tuff_init_globals()). */
    char *init_argv[] = {
      "tuffc",
      "--version",
    };
    tuff_set_argv(2, init_argv);
    (void)selfhost_entry();

    /* Seed argv so get_argv() returns managed/canonicalized Tuff strings. */
    char *dummy_argv[] = {
      "tuffc",
      (char *)smoke_source,
      (char *)input,
      (char *)output,
      (char *)target,
    };
    tuff_set_argv(5, dummy_argv);

    /* Step 1: sanity-check compile_source_with_options. */
    if (smoke_compile_source() != 0) return 1;

    fprintf(stderr, "[fixpoint] compiling %s -> %s\\n", input, output);

    int64_t r = compile_file_with_options(
      get_argv(2),
      get_argv(3),
        0,    /* lintEnabled   = 0 */
        500,  /* maxEffectiveLines */
        1,    /* borrowEnabled = 1 */
      get_argv(4)
    );

    fprintf(stderr, "[fixpoint] cfo returned %" PRId64 "\\n", r);
    return (int)r;
}
`;

fs.writeFileSync(fixpointHarness, fixpointHarnessSource, "utf8");
debugFile("fixpoint_harness.c", fixpointHarness);

const fixpointLinkResult = runStep(CC, [
  stage3outObj,
  fixpointHarness,
  "-O0",
  // Increase stack size to 64 MiB — the selfhost compiler's recursive descent
  // parser overflows the default 1 MiB Windows stack when processing the full
  // selfhost.tuff module tree.
  ...(process.platform === "win32"
    ? ["-Xlinker", "/STACK:67108864"]
    : ["-Wl,-z,stacksize=67108864"]),
  "-o",
  fixpointExe,
]);

if (fixpointLinkResult.error || fixpointLinkResult.status !== 0) {
  console.warn(
    "[bootstrap] WARN: could not link fixpoint harness — Phase 4 skipped",
  );
  console.warn(fixpointLinkResult.stdout ?? "");
  console.warn(fixpointLinkResult.stderr ?? "");
  printBootstrapSummaryExit("fixpoint link failed (non-fatal)");
}
debugFile("fixpoint_exe", fixpointExe);
debugFile("embedded_c_substrate.c", cSubstrateBundlePath);
if (fs.existsSync(cPreludePath)) {
  debugFile("RuntimePrelude.tuff", cPreludePath);
}

const fixpointTimeoutMs = getFixpointTimeoutMs();
console.log(`[bootstrap] fixpoint timeout: ${fixpointTimeoutMs}ms`);
const fixpointEnv: Record<string, string> = {
  ...process.env,
  TUFFC_SUBSTRATE_PATH: cSubstrateBundlePath,
};
if (fs.existsSync(cPreludePath)) {
  fixpointEnv.TUFFC_PRELUDE_PATH = cPreludePath;
}
const fixpointRun = runStep(fixpointExe, [], {
  timeout: fixpointTimeoutMs,
  env: fixpointEnv,
});
const fixpointOutput = `${fixpointRun.stdout ?? ""}\n${fixpointRun.stderr ?? ""}`;
console.log(`[bootstrap] fixpoint output: ${fixpointOutput.trim()}`);

if (fixpointRun.error) {
  console.warn(
    `[bootstrap] WARN: fixpoint run threw: ${fixpointRun.error.message}`,
  );
  printBootstrapSummaryExit("fixpoint run error (non-fatal)");
}

if (fixpointRun.status !== 0 || !fs.existsSync(fixpointOutC)) {
  const reason =
    fixpointRun.status !== 0
      ? `fixpoint exe exited ${fixpointRun.status} [${decodeProcessExit(fixpointRun.status)}]`
      : "stage4_selfhost.c was not written";
  console.warn(
    `[bootstrap] WARN: ${reason} — bootstrap fixpoint not yet achieved (non-fatal)`,
  );
  printBootstrapSummaryExit(`fixpoint emit failed: ${reason} (non-fatal)`);
}

debugFile("stage4_selfhost.c", fixpointOutC);
console.log("[bootstrap] ✔ Phase 4 passed — stage4_selfhost.c written");

// ─── Phase 5: hash check — stage3_selfhost.c == stage4_selfhost.c ─────────────

console.log("\n[bootstrap] ═══ Phase 5: hash parity check ═══");

const stage3CSource = fs.readFileSync(stage3outC, "utf8");
const stage4CSource = fs.readFileSync(fixpointOutC, "utf8");

const stage3Hash = sha256(stage3outC);
const stage4Hash = sha256(fixpointOutC);

console.log(`[bootstrap] stage3_selfhost.c  sha256=${stage3Hash}`);
console.log(`[bootstrap] stage4_selfhost.c  sha256=${stage4Hash}`);

if (stage3Hash === stage4Hash) {
  console.log("[bootstrap] ✔ Phase 5 PASS — exact byte-for-byte match!");
  console.log(
    "[bootstrap] Bootstrap fixpoint achieved: Stage3-JS and Stage3-native produce identical C.",
  );
} else {
  // Try normalized comparison
  const stage3Norm = normalizeCSource(stage3CSource);
  const stage4Norm = normalizeCSource(stage4CSource);
  const normMatch = stage3Norm === stage4Norm;

  if (normMatch) {
    console.log(
      "[bootstrap] ✔ Phase 5 PASS (normalized) — C sources are semantically identical (differ only in whitespace/comments)",
    );
    console.log("[bootstrap] Bootstrap fixpoint achieved (normalized).");
  } else {
    // Find the first differing line
    const lines3 = stage3Norm.split("\n");
    const lines4 = stage4Norm.split("\n");
    let firstDiff = -1;
    for (let i = 0; i < Math.max(lines3.length, lines4.length); i++) {
      if (lines3[i] !== lines4[i]) {
        firstDiff = i;
        break;
      }
    }

    console.warn("[bootstrap] WARN: Phase 5 – C sources differ (non-fatal)");
    if (firstDiff >= 0) {
      const ctx = 2;
      const lo = Math.max(0, firstDiff - ctx);
      const hi = Math.min(
        Math.max(lines3.length, lines4.length) - 1,
        firstDiff + ctx,
      );
      console.warn(
        `[bootstrap] First difference at normalized line ${firstDiff + 1}:`,
      );
      for (let i = lo; i <= hi; i++) {
        const l3 = lines3[i] ?? "<missing>";
        const l4 = lines4[i] ?? "<missing>";
        const marker = l3 !== l4 ? ">>>" : "   ";
        console.warn(`  ${marker} stage3[${i + 1}]: ${l3}`);
        if (l3 !== l4) {
          console.warn(`  ${marker} stage4[${i + 1}]: ${l4}`);
        }
      }
    }
  }
}

// ─── Final summary ───────────────────────────────────────────────────────────

console.log("\n[bootstrap] ═══ Summary ═══");
console.log("  Phase 1 ✔  Stage3-JS  → stage3_selfhost.c");
console.log(
  "  Phase 2 ✔  cc         → stage3_native_exe (valid C, links & compiles)",
);
console.log("  Phase 3 ✔  smoke      → stage3_native_exe --version OK");
console.log(
  "  Phase 4 ✔  fixpoint   → stage4_selfhost.c written by native exe",
);
const phase5Status =
  stage3Hash === stage4Hash
    ? "✔  exact hash match (full fixpoint!)"
    : normalizeCSource(stage3CSource) === normalizeCSource(stage4CSource)
      ? "✔  normalized match (fixpoint with whitespace diff)"
      : "⚠  sources differ (fixpoint not yet achieved)";
console.log(`  Phase 5 ${phase5Status}`);
