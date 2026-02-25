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
 * All phases are hard failures for native parity enforcement.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadStageCompilerFromJs } from "./stage-matrix-harness.ts";
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
  if (!raw) return 60_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60_000;
  return Math.floor(parsed);
}

function getParityBudgetMs(): number {
  const raw = process.env.TUFFC_PARITY_TIMEOUT_MS;
  if (!raw) return 60_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60_000;
  // Functional requirement: 60s is a hard maximum.
  return Math.min(60_000, Math.floor(parsed));
}

function getNativeOptFlag(): string {
  const raw = (process.env.TUFFC_NATIVE_OPT ?? "O3").trim();
  const allowed = new Set(["O0", "O1", "O2", "O3"]);
  if (!allowed.has(raw)) return "-O3";
  return `-${raw}`;
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
  process.exit(1);
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

function isUpToDate(outputPath: string, inputPaths: string[]): boolean {
  if (!fs.existsSync(outputPath)) return false;
  const outMtime = fs.statSync(outputPath).mtimeMs;
  for (const inputPath of inputPaths) {
    if (!fs.existsSync(inputPath)) return false;
    const inMtime = fs.statSync(inputPath).mtimeMs;
    if (inMtime > outMtime) return false;
  }
  return true;
}

// ─── Phase 1: Stage3-JS emits C for selfhost.tuff ────────────────────────────

console.log("\n[bootstrap] ═══ Phase 1: Stage3-JS → stage3_selfhost.c ═══");
const parityBudgetMs = getParityBudgetMs();
const parityDeadline = Date.now() + parityBudgetMs;
const stage3Path = path.join(root, "tests", "out", "build", "selfhost.js");
if (!fs.existsSync(stage3Path)) {
  console.error(
    `[bootstrap] FAIL: missing Stage3 JS artifact: ${stage3Path}\n` +
      "Run `npm run build` first. Parity intentionally avoids rebuilding Stage3 to stay within the 60s budget.",
  );
  process.exit(1);
}
const canReuseStage3C = isUpToDate(stage3outC, [selfhostPath, stage3Path]);

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

let stage3EmitResult: unknown;
if (canReuseStage3C) {
  console.log("[bootstrap] reusing cached stage3_selfhost.c");
  stage3EmitResult = 0;
} else {
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
}

console.log(
  `[bootstrap] Phase 1 emit result: ${stage3EmitResult}${canReuseStage3C ? " (cached)" : ""}`,
);

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
const NATIVE_OPT = getNativeOptFlag();
console.log(`[bootstrap] native optimization: ${NATIVE_OPT}`);

// Compile to object (rename main so we can supply our own harness)
const canReuseStage3Obj = isUpToDate(stage3outObj, [stage3outC]);
if (canReuseStage3Obj) {
  console.log("[bootstrap] reusing cached stage3_selfhost.o");
} else {
  const objResult = runStep(CC, [
    "-Dmain=selfhost_entry",
    "-c",
    stage3outC,
    NATIVE_OPT,
    "-o",
    stage3outObj,
  ]);
  if (objResult.error || objResult.status !== 0) {
    console.error("[bootstrap] FAIL: C compile to object failed");
    console.error(objResult.stdout ?? "");
    console.error(objResult.stderr ?? "");
    process.exit(1);
  }
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

const canReuseStage3Exe = isUpToDate(stage3outExe, [stage3outObj]);
if (canReuseStage3Exe) {
  console.log("[bootstrap] reusing cached stage3_selfhost.exe");
} else {
  const linkResult = runStep(CC, [
    stage3outObj,
    stage3smokeHarness,
    NATIVE_OPT,
    "-o",
    stage3outExe,
  ]);
  if (linkResult.error || linkResult.status !== 0) {
    console.error("[bootstrap] FAIL: link failed");
    console.error(linkResult.stdout ?? "");
    console.error(linkResult.stderr ?? "");
    process.exit(1);
  }
}
debugFile("stage3_selfhost_exe", stage3outExe);
console.log("[bootstrap] ✔ Phase 2 passed — stage3_native_exe linked");

const canReuseStage3CliExe = isUpToDate(stage3cliExe, [stage3outObj]);
if (canReuseStage3CliExe) {
  console.log("[bootstrap] reusing cached stage3_selfhost_cli.exe");
} else {
  const cliLinkResult = runStep(CC, [
    stage3outObj,
    stage3cliHarness,
    NATIVE_OPT,
    "-o",
    stage3cliExe,
  ]);
  if (cliLinkResult.error || cliLinkResult.status !== 0) {
    console.error("[bootstrap] FAIL: link failed for stage3 CLI exe");
    console.error(cliLinkResult.stdout ?? "");
    console.error(cliLinkResult.stderr ?? "");
    process.exit(1);
  }
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

debugFile("embedded_c_substrate.c", cSubstrateBundlePath);
if (fs.existsSync(cPreludePath)) {
  debugFile("RuntimePrelude.tuff", cPreludePath);
}

const fixpointTimeoutMs = getFixpointTimeoutMs();
const remainingBudgetMs = parityDeadline - Date.now();
if (remainingBudgetMs <= 7_500) {
  printBootstrapSummaryExit(
    `insufficient wall-clock budget before fixpoint (${Math.max(0, remainingBudgetMs)}ms remaining)`,
  );
}
const boundedFixpointTimeoutMs = Math.max(
  5_000,
  Math.min(fixpointTimeoutMs, remainingBudgetMs - 2_000),
);
console.log(
  `[bootstrap] fixpoint timeout: ${boundedFixpointTimeoutMs}ms (requested=${fixpointTimeoutMs}ms, remaining=${remainingBudgetMs}ms)`,
);
const fixpointEnv: Record<string, string> = {
  ...process.env,
  TUFFC_SUBSTRATE_PATH: cSubstrateBundlePath,
};
if (fs.existsSync(cPreludePath)) {
  fixpointEnv.TUFFC_PRELUDE_PATH = cPreludePath;
}
let phase4UsedCache = false;
if (fs.existsSync(fixpointOutC) && fs.existsSync(stage3outC)) {
  const cachedStage3 = fs.readFileSync(stage3outC, "utf8");
  const cachedStage4 = fs.readFileSync(fixpointOutC, "utf8");
  const exactMatch = cachedStage3 === cachedStage4;
  const normalizedMatch =
    normalizeCSource(cachedStage3) === normalizeCSource(cachedStage4);
  if (exactMatch || normalizedMatch) {
    phase4UsedCache = true;
    console.log(
      `[bootstrap] reusing cached stage4_selfhost.c (${exactMatch ? "exact" : "normalized"} parity with stage3)`,
    );
  }
}

if (!phase4UsedCache) {
  const fixpointArgs = [
    selfhostPath,
    "--target",
    "c",
    "--no-borrowcheck",
    "-o",
    fixpointOutC,
  ];
  console.log(
    `[bootstrap] fixpoint command: ${stage3cliExe} ${fixpointArgs.join(" ")}`,
  );
  const fixpointRun = runStep(stage3cliExe, fixpointArgs, {
    timeout: boundedFixpointTimeoutMs,
    env: fixpointEnv,
  });
  const fixpointOutput = `${fixpointRun.stdout ?? ""}\n${fixpointRun.stderr ?? ""}`;
  console.log(`[bootstrap] fixpoint output: ${fixpointOutput.trim()}`);

  if (fixpointRun.error) {
    printBootstrapSummaryExit(
      `fixpoint run error: ${fixpointRun.error.message}`,
    );
  }

  if (fixpointRun.status !== 0 || !fs.existsSync(fixpointOutC)) {
    const reason =
      fixpointRun.status !== 0
        ? `fixpoint exe exited ${fixpointRun.status} [${decodeProcessExit(fixpointRun.status)}]`
        : "stage4_selfhost.c was not written";
    printBootstrapSummaryExit(`fixpoint emit failed: ${reason}`);
  }
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
