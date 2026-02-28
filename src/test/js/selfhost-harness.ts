// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as runtime from "../../main/js/runtime.ts";
import {
  buildExportSnippet,
  CORE_STAGE_EXPORT_NAMES,
  CPD_EXPORT_NAMES,
} from "./selfhost-export-utils.ts";

export function timingEnabled(): boolean {
  const v = process.env.TUFFC_DEBUG_TIMING;
  return v === "1" || v?.toLowerCase() === "true";
}

function tlog(msg: string): void {
  if (timingEnabled()) {
    console.log(`[selfhost-harness][timing] ${msg}`);
  }
}

function nowMs(): number {
  return Date.now();
}

/**
 * The canonical pre-built selfhost JS artifact produced by `npm run build`.
 * All selfhost-consuming tests load from here — never recompile on their own.
 */
export function getCanonicalSelfhostJsPath(root: string): string {
  return path.join(root, "tests", "out", "build", "selfhost.js");
}

function requireBuildArtifact(buildArtifact: string): void {
  if (!fs.existsSync(buildArtifact)) {
    throw new Error(
      "[selfhost-harness] Build artifact not found: " +
        buildArtifact +
        "\nRun 'npm run build' to produce it, then re-run tests.",
    );
  }
}

export function compileAndLoadSelfhost(root: string, outDir: string) {
  const t0 = nowMs();
  const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
  const buildArtifact = getCanonicalSelfhostJsPath(root);

  requireBuildArtifact(buildArtifact);

  tlog(`loading selfhost JS from build artifact`);
  const tReadStart = nowMs();
  const selfhostJs = fs.readFileSync(buildArtifact, "utf8");
  tlog(`read ${selfhostJs.length} chars in ${nowMs() - tReadStart}ms`);

  const tParseStart = nowMs();
  try {
    new vm.Script(selfhostJs);
  } catch (parseErr) {
    throw new Error(
      [
        `[selfhost-harness] Build artifact failed VM parse: ${parseErr}`,
        `Artifact: ${buildArtifact}`,
        `Re-run 'npm run build' to regenerate it.`,
      ].join("\n"),
    );
  }
  tlog(`VM parse succeeded in ${nowMs() - tParseStart}ms`);

  const selfhost = buildSelfhostSandbox(selfhostJs);
  tlog(`total compileAndLoadSelfhost time: ${nowMs() - t0}ms`);

  return { selfhostPath, selfhostJs, selfhost };
}

function buildSelfhostSandbox(selfhostJs: string): Record<string, unknown> {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  const exportSnippet = buildExportSnippet([
    ...CORE_STAGE_EXPORT_NAMES,
    ...CPD_EXPORT_NAMES,
  ]);

  vm.runInNewContext(`${selfhostJs}${exportSnippet}`, sandbox);
  return sandbox.module.exports;
}
