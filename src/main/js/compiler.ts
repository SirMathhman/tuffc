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

function parseModuleImportSpecs(source) {
  const specs = [];
  const re =
    /let\s*\{[^}]*\}\s*=\s*([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*;/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const spec = m[1]?.trim();
    if (spec) specs.push(spec);
  }
  return specs;
}

function moduleSpecToRelativePath(spec) {
  return `${spec.replaceAll("::", "/")}.tuff`;
}

function buildModuleSourceOrder(entryAbsPath, moduleBaseAbsPath) {
  const seen = new Set();
  const visiting = new Set();
  const order = [];
  const sourceByFile = new Map();

  function visit(fileAbsPath) {
    const norm = toPosixPath(path.resolve(fileAbsPath));
    if (seen.has(norm)) return;
    if (visiting.has(norm)) return;
    visiting.add(norm);

    let source = "";
    try {
      source = fs.readFileSync(norm, "utf8");
    } catch {
      source = "";
    }
    sourceByFile.set(norm, source);

    const imports = parseModuleImportSpecs(source);
    for (const spec of imports) {
      const depRel = moduleSpecToRelativePath(spec);
      const depAbs = toPosixPath(path.resolve(moduleBaseAbsPath, depRel));
      visit(depAbs);
    }

    visiting.delete(norm);
    seen.add(norm);
    order.push(norm);
  }

  visit(entryAbsPath);
  return { order, sourceByFile };
}

function countLines(source) {
  if (source.length === 0) return 1;
  return source.split(/\r?\n/).length;
}

function mapMergedLineToModuleLoc(mergedLine, moduleOrder, sourceByFile) {
  let cursor = 1;
  for (let i = 0; i < moduleOrder.length; i += 1) {
    const filePath = moduleOrder[i];
    const src = sourceByFile.get(filePath) ?? "";
    const lineCount = countLines(src);
    const start = cursor;
    const end = start + lineCount - 1;
    if (mergedLine >= start && mergedLine <= end) {
      return {
        filePath,
        line: mergedLine - start + 1,
      };
    }
    cursor = end + 1;
    if (i < moduleOrder.length - 1) {
      cursor += 2; // join_sources inserts "\n\n" between modules
    }
  }
  return undefined;
}

function remapSelfhostModuleErrorLoc(error, absInput, options) {
  if (!(error instanceof TuffError)) {
    return undefined;
  }
  const mergedLine = Number(error.loc?.line ?? 0);
  if (!Number.isFinite(mergedLine) || mergedLine <= 0) {
    return undefined;
  }

  const moduleBaseDir = options?.modules?.moduleBaseDir
    ? path.resolve(options.modules.moduleBaseDir)
    : path.dirname(absInput);

  const { order, sourceByFile } = buildModuleSourceOrder(
    absInput,
    moduleBaseDir,
  );
  const mapped = mapMergedLineToModuleLoc(mergedLine, order, sourceByFile);
  if (!mapped) {
    return { sourceByFile };
  }

  error.loc = {
    ...(error.loc ?? {}),
    filePath: mapped.filePath,
    line: mapped.line,
  };

  return { sourceByFile };
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
  setEnvIfExists(env, "TUFFC_SUBSTRATE_PATH", substratePath);
  setEnvIfExists(env, "TUFFC_PRELUDE_PATH", preludePath);

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
        reason: `exit=${compile.status ?? "unknown"}, signal=${compile.signal ?? "none"}, artifact=${fs.existsSync(selfhostOutput) ? "present" : "absent"}`,
        fix: "Investigate native compiler issues and regenerate via `npm run native:selfhost:parity`.",
      }),
    );
  }

  return loadSelfhostFromDisk(selfhostOutput);
}

function loadSelfhostFromDisk(selfhostOutput): CompilerResult<unknown> {
  const selfhostJs = fs.readFileSync(selfhostOutput, "utf8");
  process.stderr.write(
    `[tuffc] loading selfhost compiler (${(selfhostJs.length / 1024).toFixed(0)} KB)...\n`,
  );
  const loadStart = Date.now();

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
      `${selfhostJs}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, take_lint_issues, main, ...(typeof format_source_tuff === \"function\" ? { format_source_tuff } : {}) };`,
      sandbox,
      { filename: toPosixPath(selfhostOutput) },
    );
    process.stderr.write(
      `[tuffc] selfhost compiler loaded in ${Date.now() - loadStart}ms\n`,
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
  profileJson?,
  profile?,
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
    profileJson,
    profile,
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
  lintEnabled: number;
  maxEffectiveLines: number;
  lintMode: string;
}> {
  const selfhostResult = run("selfhost-bootstrap", () =>
    bootstrapSelfhostCompiler(options),
  );
  if (!selfhostResult.ok) return selfhostResult;
  const { lintEnabled, maxEffectiveLines, lintMode } =
    getSelfhostLintConfig(options);
  return ok({
    selfhost: selfhostResult.value,
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

type SelfhostCompileContext = {
  target: string;
  run: ReturnType<typeof createTracer>;
  borrowEnabled: boolean;
  selfhost: Record<string, unknown>;
  lintEnabled: number;
  maxEffectiveLines: number;
  lintMode: unknown;
};

function initializeCompileContext(
  options: Record<string, unknown>,
): CompilerResult<SelfhostCompileContext> {
  const target = getCodegenTarget(options);
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;

  const run = createTracer(options.tracePasses);
  const borrowEnabled = isBorrowcheckEnabled(options);
  const selfhostOptionsCheck = ensureSelfhostBackendOptions(target, options);
  if (!selfhostOptionsCheck.ok) return selfhostOptionsCheck;

  const selfhostContextResult = initializeSelfhostCompileContext(run, options);
  if (!selfhostContextResult.ok) return selfhostContextResult;
  const { selfhost, lintEnabled, maxEffectiveLines, lintMode } =
    selfhostContextResult.value;
  return ok({
    target,
    run,
    borrowEnabled,
    selfhost,
    lintEnabled,
    maxEffectiveLines,
    lintMode,
  });
}

function withCompileContext<T>(
  options: Record<string, unknown>,
  fn: (ctx: SelfhostCompileContext) => CompilerResult<T>,
): CompilerResult<T> {
  const ctxResult = initializeCompileContext(options);
  if (!ctxResult.ok) return ctxResult;
  return fn(ctxResult.value);
}

export function compileSource(
  source: string,
  filePath: string = "<memory>",
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  return withCompileContext(
    options,
    ({
      target,
      run,
      borrowEnabled,
      selfhost,
      lintEnabled,
      maxEffectiveLines,
      lintMode,
    }) => {
      let js;
      setSubstrateOverrideFromOptions(options, target, "selfhost");
      try {
        js = runSelfhostCompileSource(
          run,
          selfhost,
          source,
          lintEnabled,
          maxEffectiveLines,
          borrowEnabled ? 1 : 0,
          target,
        );
      } catch (error) {
        return err(
          wrapTuffError(error, {
            source,
            filePath,
          }),
        );
      } finally {
        runtimeCSubstrateOverride = undefined;
      }
      return finalizeSelfhostCompile(selfhost, source, js, lintMode, target);
    },
  );
}

function runSelfhostCompileSource(
  run: (label: string, fn: () => string) => string,
  selfhost: Record<string, unknown>,
  source: string,
  lintEnabled: unknown,
  maxEffectiveLines: unknown,
  borrowEnabled: unknown,
  target: unknown,
): string {
  return run("selfhost-compile-source", () =>
    typeof selfhost.compile_source_with_options === "function"
      ? (
          selfhost.compile_source_with_options as (
            src: string,
            le: unknown,
            mel: unknown,
            be: unknown,
            t: unknown,
          ) => string
        )(source, lintEnabled, maxEffectiveLines, borrowEnabled, target)
      : (selfhost.compile_source as (src: string) => string)(source),
  );
}

function finalizeSelfhostCompile(
  selfhost: Record<string, unknown>,
  source: string,
  js: string,
  lintMode: unknown,
  target: unknown,
  outputPath?: string,
): CompilerResult<Record<string, unknown>> {
  let profileJson = "";
  let profile = undefined;
  if (typeof runtime.profile_take_json === "function") {
    profileJson = runtime.profile_take_json();
    if (typeof profileJson === "string" && profileJson.length > 0) {
      try {
        profile = JSON.parse(profileJson);
      } catch {
        profile = undefined;
      }
    }
  }
  const lintIssuesResult = handleSelfhostLintIssues(selfhost, source, lintMode);
  if (!lintIssuesResult.ok) return lintIssuesResult;
  return ok(
    makeSelfhostCompileResult(
      source,
      js,
      target,
      lintIssuesResult.value,
      outputPath,
      profileJson,
      profile,
    ),
  );
}

function setEnvIfExists(
  env: Record<string, string | undefined>,
  key: string,
  filePath: string,
): void {
  if (fs.existsSync(filePath)) {
    env[key] = filePath;
  }
}

function wrapTuffError(
  error: unknown,
  enrichCtx: Record<string, unknown>,
): TuffError {
  const enriched = enrichError(error, enrichCtx);
  return enriched instanceof TuffError
    ? enriched
    : new TuffError(String(error), undefined);
}

function compileFileInternal(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  return withCompileContext(options, (ctx) => {
    const {
      target,
      run,
      borrowEnabled,
      selfhost,
      lintEnabled,
      maxEffectiveLines,
      lintMode,
    } = ctx;
    const absInput = path.resolve(inputPath);
    const finalOutput = outputPath ?? defaultOutputPath(absInput, target);
    const source = fs.readFileSync(absInput, "utf8");

    let js;
    if (typeof runtime.profile_take_json === "function") {
      runtime.profile_take_json();
    }
    if (typeof runtime.profile_take_json === "function") {
      runtime.profile_take_json();
    }
    setSubstrateOverrideFromOptions(options, target, "selfhost");
    try {
      const normalizedInput = toPosixPath(absInput);
      const normalizedOutput = toPosixPath(finalOutput);
      process.stderr.write(
        `[tuffc] compiling ${path.basename(absInput)} (lint=${lintEnabled}, borrow=${borrowEnabled ? 1 : 0}, target=${target})...\n`,
      );
      const compileStart = Date.now();
      let heartbeatTick = 0;
      const heartbeat = setInterval(() => {
        heartbeatTick++;
        const elapsed = Date.now() - compileStart;
        process.stderr.write(
          `[tuffc]   still running... ${elapsed}ms elapsed (tick ${heartbeatTick})\n`,
        );
      }, 5000);
      try {
        run("selfhost-compile-file", () => {
          if (typeof selfhost.compile_file_with_options === "function") {
            selfhost.compile_file_with_options(
              normalizedInput,
              normalizedOutput,
              lintEnabled,
              maxEffectiveLines,
              borrowEnabled ? 1 : 0,
              target,
            );
          } else {
            selfhost.compile_file(normalizedInput, normalizedOutput);
          }
        });
      } finally {
        clearInterval(heartbeat);
      }
      process.stderr.write(
        `[tuffc] compilation done in ${Date.now() - compileStart}ms\n`,
      );
      js = fs.readFileSync(finalOutput, "utf8");
    } catch (error) {
      const remap = remapSelfhostModuleErrorLoc(error, absInput, options);
      return err(
        wrapTuffError(error, {
          filePath: absInput,
          sourceByFile:
            remap?.sourceByFile ??
            new Map([[absInput, fs.readFileSync(absInput, "utf8")]]),
          source: fs.existsSync(absInput)
            ? fs.readFileSync(absInput, "utf8")
            : undefined,
        }),
      );
    } finally {
      runtimeCSubstrateOverride = undefined;
    }
    return finalizeSelfhostCompile(
      selfhost,
      source,
      js,
      lintMode,
      target,
      finalOutput,
    );
  });
}

export function compileFile(
  inputPath: string,
  outputPath?: string,
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
    throw result.error;
  }
  return result.value;
}

export function formatTuffSource(
  source: string,
  options: Record<string, unknown> = {},
): CompilerResult<string> {
  const run = createTracer(options.tracePasses);
  const selfhostResult = run("selfhost-bootstrap", () =>
    bootstrapSelfhostCompiler(options),
  );
  if (!selfhostResult.ok) return selfhostResult;
  const selfhost = selfhostResult.value as Record<string, unknown>;

  try {
    if (typeof selfhost.format_source_tuff === "function") {
      return ok(
        (selfhost.format_source_tuff as (src: string) => string)(source),
      );
    }
    return err(
      new TuffError("Selfhost formatter export not available", undefined, {
        code: "E_SELFHOST_FORMATTER_UNAVAILABLE",
        reason:
          "The loaded selfhost artifact does not expose format_source_tuff.",
        fix: "Rebuild selfhost artifacts and retry formatting.",
      }),
    );
  } catch (error) {
    return err(
      wrapTuffError(error, {
        source,
      }),
    );
  }
}

export const compileSourceResult = compileSource;
export const compileFileResult = compileFile;
