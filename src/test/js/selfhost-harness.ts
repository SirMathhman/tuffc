// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import * as runtime from "../../main/js/runtime.ts";

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

function summarizeText(text: string | null | undefined, max = 300): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function compileAndLoadSelfhost(root: string, outDir: string) {
  const t0 = nowMs();
  const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
  const outputPath = path.join(outDir, "selfhost.js");
  const relInput = path.relative(root, selfhostPath).replaceAll("\\", "/");
  const relOutput = path.relative(root, outputPath).replaceAll("\\", "/");
  const relModuleBase = "./src/main";
  fs.mkdirSync(outDir, { recursive: true });

  const nativeExe = path.join(
    root,
    "tests",
    "out",
    "c-bootstrap",
    process.platform === "win32"
      ? "stage3_selfhost_cli.exe"
      : "stage3_selfhost_cli",
  );
  const substratePath = path.join(
    root,
    "tests",
    "out",
    "c-bootstrap",
    "embedded_c_substrate.c",
  );
  const preludePath = path.join(
    root,
    "src",
    "main",
    "tuff-c",
    "RuntimePrelude.tuff",
  );

  if (!fs.existsSync(nativeExe)) {
    throw new Error(
      `Missing native selfhost executable: ${nativeExe}. Run 'npm run native:selfhost:parity' first.`,
    );
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (fs.existsSync(substratePath)) {
    env.TUFFC_SUBSTRATE_PATH = substratePath;
  }
  if (fs.existsSync(preludePath)) {
    env.TUFFC_PRELUDE_PATH = preludePath;
  }

  const compile = spawnSync(
    nativeExe,
    [
      `./${relInput}`,
      "--modules",
      "--module-base",
      relModuleBase,
      "--target",
      "js",
      "-o",
      `./${relOutput}`,
    ],
    {
      cwd: root,
      env,
      encoding: "utf8",
    },
  );

  tlog(
    `native compile finished in ${nowMs() - t0}ms (status=${compile.status}, signal=${compile.signal ?? "none"}, error=${compile.error ? compile.error.message : "none"})`,
  );

  let selfhostJs = "";
  let nativeOk =
    !compile.error && compile.status === 0 && fs.existsSync(outputPath);
  if (!nativeOk) {
    tlog(
      `native output not usable; stdout='${summarizeText(compile.stdout)}' stderr='${summarizeText(compile.stderr)}'`,
    );
  }
  if (nativeOk) {
    const tReadStart = nowMs();
    selfhostJs = fs.readFileSync(outputPath, "utf8");
    tlog(
      `read native selfhost JS (${selfhostJs.length} chars) in ${nowMs() - tReadStart}ms`,
    );
    try {
      const tParseStart = nowMs();
      new vm.Script(selfhostJs);
      tlog(
        `native selfhost JS VM parse succeeded in ${nowMs() - tParseStart}ms`,
      );
    } catch {
      nativeOk = false;
      tlog("native selfhost JS VM parse failed");
    }
  }

  if (!nativeOk) {
    const stderr = summarizeText(compile.stderr, 1000);
    const stdout = summarizeText(compile.stdout, 1000);
    throw new Error(
      [
        "Native selfhost compile produced unusable JS output.",
        `subject: ${selfhostPath}`,
        `reason: exit=${compile.status ?? "unknown"}, signal=${compile.signal ?? "none"}, output_exists=${fs.existsSync(outputPath)}`,
        "fix: Investigate native JS emitter/parsing issues and regenerate stage3_selfhost_cli via `npm run native:selfhost:parity`.",
        `stderr: ${stderr}`,
        `stdout: ${stdout}`,
      ].join("\n"),
    );
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  const exportedNames = [
    "compile_source",
    "compile_file",
    "compile_source_with_options",
    "compile_file_with_options",
    "take_lint_issues",
    "main",
  ].join(", ");

  const tVmLoadStart = nowMs();
  vm.runInNewContext(
    `${selfhostJs}\nmodule.exports = { ${exportedNames} };`,
    sandbox,
  );
  tlog(`loaded selfhost module exports in ${nowMs() - tVmLoadStart}ms`);
  tlog(`total compileAndLoadSelfhost time: ${nowMs() - t0}ms`);

  return {
    selfhostPath,
    selfhostJs,
    selfhost: sandbox.module.exports,
  };
}
