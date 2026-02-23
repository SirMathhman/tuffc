// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as runtime from "../../main/js/runtime.ts";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";

function timingEnabled(): boolean {
  const v = process.env.TUFFC_DEBUG_TIMING;
  return v === "1" || v?.toLowerCase() === "true";
}

function tlog(msg: string): void {
  if (timingEnabled()) {
    console.log(`[stage-matrix][timing] ${msg}`);
  }
}

function nowMs(): number {
  return Date.now();
}

function loadStageCompilerFromJs(js) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };
  vm.runInNewContext(
    `${js}
const __exports = {};
if (typeof compile_source !== "undefined") __exports.compile_source = compile_source;
if (typeof compile_file !== "undefined") __exports.compile_file = compile_file;
if (typeof compile_source_with_options !== "undefined") __exports.compile_source_with_options = compile_source_with_options;
if (typeof compile_file_with_options !== "undefined") __exports.compile_file_with_options = compile_file_with_options;
if (typeof take_lint_issues !== "undefined") __exports.take_lint_issues = take_lint_issues;
if (typeof main !== "undefined") __exports.main = main;
module.exports = __exports;`,
    sandbox,
  );
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
    stage2.compile_file_with_options(
      selfhostPath,
      stage3Path,
      0,
      0,
      500,
      1,
      "js",
    );
  } else if (typeof stage2.compile_file === "function") {
    stage2.compile_file(selfhostPath, stage3Path);
  } else {
    const stage3JsFromSource =
      typeof stage2.compile_source_with_options === "function"
        ? stage2.compile_source_with_options(selfhostSource, 0, 0, 500, 1, "js")
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
