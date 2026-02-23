// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getEmbeddedCSubstrateSupport } from "./c-runtime-support.ts";
import { TuffError, enrichError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";
import * as runtime from "./runtime.ts";

const __compilerFile = fileURLToPath(import.meta.url);
const __runtimeRoot = path.resolve(path.dirname(__compilerFile), "..");
const __cRuntimePreludePath = path.join(
  __runtimeRoot,
  "tuff-c",
  "RuntimePrelude.tuff",
);

type CompilerResult<T> = Result<T, TuffError>;

function makeEmptyMonomorphizationPlan(reason = "no-ast") {
  return {
    available: false,
    reason,
    specializations: [],
    byFunction: {},
  };
}

let cachedSelfhost = undefined;
let runtimeCSubstrateOverride = undefined;
let runtimeCPreludeSourceCache = undefined;

function resolveCSubstrate() {
  if (typeof runtimeCSubstrateOverride === "string") {
    return runtimeCSubstrateOverride;
  }
  return getEmbeddedCSubstrateSupport();
}

function getCRuntimePreludeSource() {
  if (typeof runtimeCPreludeSourceCache === "string") {
    return runtimeCPreludeSourceCache;
  }
  try {
    runtimeCPreludeSourceCache = fs.readFileSync(__cRuntimePreludePath, "utf8");
  } catch {
    runtimeCPreludeSourceCache = "";
  }
  return runtimeCPreludeSourceCache;
}

function decodeSelfhostLintIssues(payload): unknown[] {
  if (typeof payload !== "string" || payload.length === 0) return [];
  const records = payload.split("\u001e");
  const issues = [];
  for (const record of records) {
    if (!record) continue;
    const [code, message, reason, fix] = record.split("\u001f");
    if (!code || !message) continue;
    issues.push(
      new TuffError(message, undefined, {
        code,
        reason:
          reason ??
          "Linting detected a style or maintainability issue in the current program.",
        fix: fix ?? "Apply the suggested lint fix or adjust source style.",
      }),
    );
  }
  return issues;
}

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}

function getSelfhostEntryPath() {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "..", "tuff", "selfhost.tuff");
}

function bootstrapSelfhostCompiler(options = {}): CompilerResult<unknown> {
  if (cachedSelfhost) return ok(cachedSelfhost);

  const selfhostEntry = getSelfhostEntryPath();
  const selfhostOutput = path.join(
    path.dirname(selfhostEntry),
    "selfhost.generated.js",
  );

  // If the generated JS already exists on disk, skip the native exe compilation
  if (!fs.existsSync(selfhostOutput)) {
    return bootstrapSelfhostFromNativeExe(selfhostEntry, selfhostOutput);
  }

  return loadSelfhostFromDisk(selfhostOutput);
}

function bootstrapSelfhostFromNativeExe(
  selfhostEntry,
  selfhostOutput,
): CompilerResult<unknown> {
  const repoRoot = path.resolve(path.dirname(selfhostEntry), "..", "..", "..");
  const nativeExe = path.join(
    repoRoot,
    "tests",
    "out",
    "c-bootstrap",
    process.platform === "win32"
      ? "stage3_selfhost_cli.exe"
      : "stage3_selfhost_cli",
  );

  if (!fs.existsSync(nativeExe)) {
    return err(
      new TuffError(
        `Missing native selfhost executable: ${nativeExe}`,
        undefined,
        {
          code: "E_SELFHOST_BOOTSTRAP_FAILED",
          reason: "The native selfhost executable was not found.",
          fix: "Run 'npm run native:selfhost:parity' to build the native executable first.",
        },
      ),
    );
  }

  const relInput = path.relative(repoRoot, selfhostEntry).replaceAll("\\", "/");
  const relOutput = path
    .relative(repoRoot, selfhostOutput)
    .replaceAll("\\", "/");

  const env = { ...process.env };
  const substratePath = path.join(
    repoRoot,
    "tests",
    "out",
    "c-bootstrap",
    "embedded_c_substrate.c",
  );
  const preludePath = __cRuntimePreludePath;
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
      "./src/main",
      "--target",
      "js",
      "-o",
      `./${relOutput}`,
    ],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    },
  );

  if (compile.error || compile.status !== 0 || !fs.existsSync(selfhostOutput)) {
    return err(
      new TuffError("Native selfhost bootstrap compilation failed", undefined, {
        code: "E_SELFHOST_BOOTSTRAP_FAILED",
        reason: `exit=${compile.status ?? "unknown"}, signal=${compile.signal ?? "none"}, output_exists=${fs.existsSync(selfhostOutput)}`,
        fix: "Investigate native compiler issues and regenerate via `npm run native:selfhost:parity`.",
      }),
    );
  }

  return loadSelfhostFromDisk(selfhostOutput);
}

function loadSelfhostFromDisk(selfhostOutput): CompilerResult<unknown> {
  const selfhostJs = fs.readFileSync(selfhostOutput, "utf8");

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    __host_get_c_substrate: resolveCSubstrate,
    __host_get_c_runtime_prelude_source: getCRuntimePreludeSource,
    ...runtime,
  };

  try {
    vm.runInNewContext(
      `${selfhostJs}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, take_lint_issues, main };`,
      sandbox,
      { filename: toPosixPath(selfhostOutput) },
    );
  } catch (loadErr) {
    return err(
      new TuffError(
        `Failed to load selfhost JS: ${loadErr.message}`,
        undefined,
        {
          code: "E_SELFHOST_BOOTSTRAP_FAILED",
          reason: "The generated selfhost JavaScript could not be evaluated.",
          fix: "Investigate native JS emitter issues and regenerate via `npm run native:selfhost:parity`.",
        },
      ),
    );
  }

  const compiled = sandbox.module.exports;
  if (
    typeof compiled?.compile_source !== "function" ||
    typeof compiled?.compile_file !== "function"
  ) {
    return err(
      new TuffError(
        "Selfhost compiler bootstrap exports are incomplete",
        undefined,
        {
          code: "E_SELFHOST_BOOTSTRAP_FAILED",
          reason:
            "The generated selfhost JavaScript did not expose the expected compiler entry points.",
          fix: "Ensure selfhost.tuff exports compile_source and compile_file and re-run bootstrap.",
        },
      ),
    );
  }

  cachedSelfhost = compiled;
  return ok(cachedSelfhost);
}

function createTracer(enabled) {
  const trace = !!enabled;
  return (name, fn) => {
    if (!trace) return fn();
    const start = performance.now();
    const value = fn();
    const ms = (performance.now() - start).toFixed(2);
    console.error(`[trace] ${name}: ${ms}ms`);
    return value;
  };
}

function getCodegenTarget(options): string {
  return options.target ?? "js";
}

function setSubstrateOverrideFromOptions(options, target, backend) {
  if (typeof options?.cSubstrate === "string") {
    runtimeCSubstrateOverride = options.cSubstrate;
    return;
  }
  if (
    target === "c" &&
    backend === "selfhost" &&
    options?.cSubstrateMode !== "legacy"
  ) {
    runtimeCSubstrateOverride = "";
    return;
  }
  runtimeCSubstrateOverride = undefined;
}

function isSupportedTarget(target): boolean {
  return target === "js" || target === "c";
}

function ensureSupportedTarget(target): CompilerResult<true> {
  if (isSupportedTarget(target)) {
    return ok(true);
  }
  return err(
    new TuffError(`Unsupported codegen target: ${target}`, undefined, {
      code: "E_UNSUPPORTED_TARGET",
      reason:
        "The compiler was asked to emit code for a target that is not implemented.",
      fix: "Use target: 'js' or target: 'c'.",
    }),
  );
}

function ensureSelfhostBackendOptions(target, options): CompilerResult<true> {
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;
  if (options.lint?.fix) {
    return err(
      new TuffError(
        "Selfhost backend does not support lint auto-fix yet",
        undefined,
        {
          code: "E_SELFHOST_UNSUPPORTED_OPTION",
          reason:
            "The Tuff-based linter currently supports diagnostics only and does not rewrite source automatically.",
          fix: "Run without --lint-fix, or apply lint suggestions manually.",
        },
      ),
    );
  }
  return ok(true);
}

function isBorrowcheckEnabled(options, disableForBootstrap = false) {
  if (disableForBootstrap) return false;
  return options.borrowcheck?.enabled !== false;
}

function handleSelfhostLintIssues(
  selfhost,
  source,
  lintMode,
): CompilerResult<unknown[]> {
  const lintIssues =
    typeof selfhost.take_lint_issues === "function"
      ? decodeSelfhostLintIssues(selfhost.take_lint_issues())
      : [];
  for (const issue of lintIssues) {
    enrichError(issue, { source });
  }
  if (lintIssues.length > 0 && lintMode !== "warn") {
    return err(lintIssues[0]);
  }
  return ok(lintIssues);
}

function getSelfhostLintConfig(options) {
  return {
    strictSafety: 1,
    lintEnabled: options.lint?.enabled ? 1 : 0,
    maxEffectiveLines: options.lint?.maxEffectiveLines ?? 500,
    lintMode: options.lint?.mode ?? "error",
  };
}

function makeSelfhostCompileResult(
  source,
  js,
  target,
  lintIssues,
  outputPath?,
) {
  return {
    source,
    tokens: [],
    cst: { kind: "Program", body: [] },
    core: { kind: "Program", body: [] },
    js: target === "js" ? js : undefined,
    c: target === "c" ? js : undefined,
    output: js,
    target,
    lintIssues,
    monomorphizationPlan: makeEmptyMonomorphizationPlan("selfhost-backend"),
    lintFixesApplied: 0,
    lintFixedSource: source,
    ...(outputPath ? { outputPath } : {}),
  };
}

function initializeSelfhostCompileContext(
  run,
  options,
): CompilerResult<{
  selfhost: unknown;
  strictSafety: number;
  lintEnabled: number;
  maxEffectiveLines: number;
  lintMode: string;
}> {
  const selfhostResult = run("selfhost-bootstrap", () =>
    bootstrapSelfhostCompiler(options),
  );
  if (!selfhostResult.ok) return selfhostResult;
  const { strictSafety, lintEnabled, maxEffectiveLines, lintMode } =
    getSelfhostLintConfig(options);
  return ok({
    selfhost: selfhostResult.value,
    strictSafety,
    lintEnabled,
    maxEffectiveLines,
    lintMode,
  });
}

function extensionForTarget(target): string {
  return target === "c" ? ".c" : ".js";
}

function defaultOutputPath(inputPath, target): string {
  return inputPath.replace(/\.tuff$/i, extensionForTarget(target));
}

export function compileSource(
  source: string,
  filePath: string = "<memory>",
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const target = getCodegenTarget(options);
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;

  const run = createTracer(options.tracePasses);
  const borrowEnabled = isBorrowcheckEnabled(options);
  const selfhostOptionsCheck = ensureSelfhostBackendOptions(target, options);
  if (!selfhostOptionsCheck.ok) return selfhostOptionsCheck;

  const selfhostContextResult = initializeSelfhostCompileContext(run, options);
  if (!selfhostContextResult.ok) return selfhostContextResult;
  const { selfhost, strictSafety, lintEnabled, maxEffectiveLines, lintMode } =
    selfhostContextResult.value;

  let js;
  setSubstrateOverrideFromOptions(options, target, "selfhost");
  try {
    js = run("selfhost-compile-source", () =>
      typeof selfhost.compile_source_with_options === "function"
        ? selfhost.compile_source_with_options(
            source,
            strictSafety,
            lintEnabled,
            maxEffectiveLines,
            borrowEnabled ? 1 : 0,
            target,
          )
        : selfhost.compile_source(source),
    );
  } catch (error) {
    const enriched = enrichError(error, { source });
    return err(
      enriched instanceof TuffError
        ? enriched
        : new TuffError(String(error), undefined),
    );
  } finally {
    runtimeCSubstrateOverride = undefined;
  }
  const lintIssuesResult = handleSelfhostLintIssues(selfhost, source, lintMode);
  if (!lintIssuesResult.ok) return lintIssuesResult;

  return ok(
    makeSelfhostCompileResult(source, js, target, lintIssuesResult.value),
  );
}

function compileFileInternal(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const target = getCodegenTarget(options);
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;

  const run = createTracer(options.tracePasses);
  const borrowEnabled = isBorrowcheckEnabled(options);
  const selfhostOptionsCheck = ensureSelfhostBackendOptions(target, options);
  if (!selfhostOptionsCheck.ok) return selfhostOptionsCheck;

  const absInput = path.resolve(inputPath);
  const finalOutput = outputPath ?? defaultOutputPath(absInput, target);
  const selfhostContextResult = initializeSelfhostCompileContext(run, options);
  if (!selfhostContextResult.ok) return selfhostContextResult;
  const { selfhost, strictSafety, lintEnabled, maxEffectiveLines, lintMode } =
    selfhostContextResult.value;
  const source = fs.readFileSync(absInput, "utf8");

  let js;
  setSubstrateOverrideFromOptions(options, target, "selfhost");
  try {
    if (options.enableModules) {
      const normalizedInput = toPosixPath(absInput);
      const normalizedOutput = toPosixPath(finalOutput);
      run("selfhost-compile-file", () => {
        if (typeof selfhost.compile_file_with_options === "function") {
          selfhost.compile_file_with_options(
            normalizedInput,
            normalizedOutput,
            strictSafety,
            lintEnabled,
            maxEffectiveLines,
            borrowEnabled ? 1 : 0,
            target,
          );
        } else {
          selfhost.compile_file(normalizedInput, normalizedOutput);
        }
      });
      js = fs.readFileSync(finalOutput, "utf8");
    } else {
      js = run("selfhost-compile-source", () =>
        typeof selfhost.compile_source_with_options === "function"
          ? selfhost.compile_source_with_options(
              source,
              strictSafety,
              lintEnabled,
              maxEffectiveLines,
              borrowEnabled ? 1 : 0,
              target,
            )
          : selfhost.compile_source(source),
      );
      fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
      fs.writeFileSync(finalOutput, js, "utf8");
    }
  } catch (error) {
    const enriched = enrichError(error, {
      sourceByFile: new Map([[absInput, fs.readFileSync(absInput, "utf8")]]),
      source: fs.existsSync(absInput)
        ? fs.readFileSync(absInput, "utf8")
        : undefined,
    });
    return err(
      enriched instanceof TuffError
        ? enriched
        : new TuffError(String(error), undefined),
    );
  } finally {
    runtimeCSubstrateOverride = undefined;
  }

  const lintIssuesResult = handleSelfhostLintIssues(selfhost, source, lintMode);
  if (!lintIssuesResult.ok) return lintIssuesResult;

  return ok(
    makeSelfhostCompileResult(
      source,
      js,
      target,
      lintIssuesResult.value,
      finalOutput,
    ),
  );
}

export function compileFile(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  return compileFileInternal(inputPath, outputPath, options);
}

export function compileSourceThrow(
  source: string,
  filePath: string = "<memory>",
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  const result = compileSource(source, filePath, options);
  if (!result.ok) {
    // eslint-disable-next-line no-restricted-syntax -- intentional throw wrapper
    throw result.error;
  }
  return result.value;
}

export function compileFileThrow(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  const result = compileFile(inputPath, outputPath, options);
  if (!result.ok) {
    // eslint-disable-next-line no-restricted-syntax -- intentional throw wrapper
    throw result.error;
  }
  return result.value;
}

export const compileSourceResult = compileSource;
export const compileFileResult = compileFile;
