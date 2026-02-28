// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as runtime from "../../main/js/runtime.ts";
import { compileAndLoadSelfhost, timingEnabled } from "./selfhost-harness.ts";
import {
  buildExportSnippet,
  CORE_STAGE_EXPORT_NAMES,
} from "./selfhost-export-utils.ts";

function tlog(msg: string): void {
  if (timingEnabled()) {
    console.log(`[stage-matrix][timing] ${msg}`);
  }
}

function nowMs(): number {
  return Date.now();
}

const STAGE_EXPORTS_SNIPPET = buildExportSnippet(CORE_STAGE_EXPORT_NAMES);

export function loadStageCompilerFromJs(js, extraSandbox = {}) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
    ...extraSandbox,
  };
  vm.runInNewContext(`${js}${STAGE_EXPORTS_SNIPPET}`, sandbox);
  return sandbox.module.exports;
}

export function buildStageChain(root, outDir) {
  const t0 = nowMs();
  fs.mkdirSync(outDir, { recursive: true });

  const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
  const selfhostSource = fs.readFileSync(selfhostPath, "utf8");

  const tStage2Start = nowMs();
  const { selfhostJs: stage2Js, selfhost: stage2 } = compileAndLoadSelfhost(
    root,
    path.join(outDir, "stage2"),
  );
  tlog(`stage2 compile/load completed in ${nowMs() - tStage2Start}ms`);
  const stage2Path = path.join(outDir, "stage2.js");
  fs.writeFileSync(stage2Path, stage2Js, "utf8");

  const stage3Path = path.join(outDir, "stage3.js");
  const tStage3EmitStart = nowMs();
  if (typeof stage2.compile_file_with_options === "function") {
    stage2.compile_file_with_options(selfhostPath, stage3Path, 0, 500, 1, "js");
  } else if (typeof stage2.compile_file === "function") {
    stage2.compile_file(selfhostPath, stage3Path);
  } else {
    const stage3JsFromSource =
      typeof stage2.compile_source_with_options === "function"
        ? stage2.compile_source_with_options(selfhostSource, 0, 500, 1, "js")
        : stage2.compile_source(selfhostSource);
    fs.writeFileSync(stage3Path, stage3JsFromSource, "utf8");
  }
  tlog(`stage2 -> stage3 emit completed in ${nowMs() - tStage3EmitStart}ms`);

  const tStage3LoadStart = nowMs();
  const stage3Js = fs.readFileSync(stage3Path, "utf8");
  const stage3 = loadStageCompilerFromJs(stage3Js);
  tlog(`stage3 VM load completed in ${nowMs() - tStage3LoadStart}ms`);
  tlog(`total buildStageChain time: ${nowMs() - t0}ms`);

  return {
    stage2,
    stage3,
    selfhostPath,
    stage2Path,
    stage3Path,
  };
}

export function normalizeDiag(error) {
  const e = error && typeof error === "object" ? error : {};
  const code =
    typeof e.code === "string"
      ? e.code
      : typeof e.errorCode === "string"
        ? e.errorCode
        : "E_SELFHOST_INTERNAL_ERROR";
  const message =
    typeof e.message === "string" && e.message.length > 0
      ? e.message
      : "selfhost compilation failed";
  const source =
    typeof e.source === "string" && e.source.length > 0
      ? e.source
      : "<unknown source>";
  const cause =
    typeof e.cause === "string" && e.cause.length > 0 ? e.cause : message;
  const reason =
    typeof e.reason === "string" && e.reason.length > 0
      ? e.reason
      : "compiler reported an error";
  const fix =
    typeof e.fix === "string" && e.fix.length > 0
      ? e.fix
      : "Review the source and retry compilation.";
  return { code, message, source, cause, reason, fix };
}

export function buildStageById(chain) {
  function makeStageCompiler(stageId) {
    return {
      id: stageId,
      allowNegativeSkip: false,
      compileSource(source, _filePath, options = {}) {
        try {
          const lintEnabled = options.lint?.enabled ? 1 : 0;
          const maxEffectiveLines = options.lint?.maxEffectiveLines ?? 500;
          const borrowEnabled = options.borrowcheck?.enabled === false ? 0 : 1;
          const stageCompiler = chain[stageId];
          const js =
            typeof stageCompiler.compile_source_with_options === "function"
              ? stageCompiler.compile_source_with_options(
                  source,
                  lintEnabled,
                  maxEffectiveLines,
                  borrowEnabled,
                  "js",
                )
              : stageCompiler.compile_source(source);
          return { ok: true, js };
        } catch (error) {
          return { ok: false, error };
        }
      },
    };
  }
  return {
    stage2: makeStageCompiler("stage2"),
    stage3: makeStageCompiler("stage3"),
  };
}
