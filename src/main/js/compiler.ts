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
let compilerQuietMode = false;

const hostRuntimeBridgeFns = [
  "str_length",
  "str_char_at",
  "str_slice",
  "str_slice_window",
  "str_copy",
  "str_mut_slice",
  "str_concat",
  "str_eq",
  "str_from_char_code",
  "str_index_of",
  "str_trim",
  "str_replace_all",
  "char_code",
  "int_to_string",
  "parse_int",
  "sb_new",
  "sb_append",
  "sb_append_char",
  "sb_build",
  "__vec_new",
  "__vec_push",
  "__vec_pop",
  "__vec_get",
  "__vec_set",
  "__vec_length",
  "__vec_init",
  "__vec_capacity",
  "__vec_clear",
  "__vec_join",
  "__vec_includes",
  "__map_new",
  "map_set",
  "map_get",
  "map_has",
  "map_delete",
  "__set_new",
  "set_add",
  "set_has",
  "set_delete",
  "read_file",
  "write_file",
  "path_join",
  "path_dirname",
  "panic",
  "panic_with_code",
  "panic_with_code_loc",
  "get_argc",
  "get_argv",
  "perf_now",
  "profile_mark",
  "profile_take_json",
];

function patchExternStubsToHostRuntime(jsSource: string): string {
  let out = jsSource;
  for (const name of hostRuntimeBridgeFns) {
    const re = new RegExp(
      `function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?return\\s+undefined;\\s*\\}`,
      "m",
    );
    out = out.replace(
      re,
      `function ${name}(...__args) { return __host_runtime.${name}(...__args); }`,
    );
  }
  return out;
}

export function setCompilerQuietMode(quiet: boolean): void {
  compilerQuietMode = quiet;
  runtime.setRuntimeQuietMode(quiet);
}

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

function tryStatMtimeMs(filePath: string): number | undefined {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

function listTuffFilesRecursive(rootDir: string): string[] {
  const out: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && full.toLowerCase().endsWith(".tuff")) {
        out.push(full);
      }
    }
  }
  return out;
}

function splitModeKey(options: Record<string, unknown>): string {
  return typeof options?.cSubstrateMode === "string"
    ? options.cSubstrateMode
    : "default";
}

function isSplitOutputUpToDate(
  entryAbsPath: string,
  moduleBaseAbsPath: string,
  outputDir: string,
  modeKey: string,
): boolean {
  const manifestPath = path.join(outputDir, "manifest.txt");
  const manifestMtime = tryStatMtimeMs(manifestPath);
  if (manifestMtime === undefined) return false;
  const metaPath = path.join(outputDir, ".tuffcsplit.meta.json");
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta?.modeKey !== modeKey) return false;
  } catch {
    return false;
  }

  const manifestRows = fs
    .readFileSync(manifestPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (manifestRows.length === 0) return false;

  let oldestGenerated = manifestMtime;
  for (const rel of manifestRows) {
    const fileMtime = tryStatMtimeMs(path.join(outputDir, rel));
    if (fileMtime === undefined) return false;
    if (fileMtime < oldestGenerated) oldestGenerated = fileMtime;
  }

  const sourceFiles = listTuffFilesRecursive(moduleBaseAbsPath);
  if (!sourceFiles.includes(entryAbsPath)) {
    sourceFiles.push(entryAbsPath);
  }
  if (sourceFiles.length === 0) return false;
  let newestSource = 0;
  for (const modulePath of sourceFiles) {
    const moduleMtime = tryStatMtimeMs(modulePath);
    if (moduleMtime === undefined) continue;
    if (moduleMtime > newestSource) newestSource = moduleMtime;
  }
  if (newestSource === 0) return false;
  return newestSource <= oldestGenerated;
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
  const selfhostJsRaw = fs.readFileSync(selfhostOutput, "utf8");
  const selfhostJs = patchExternStubsToHostRuntime(selfhostJsRaw);
  if (!compilerQuietMode) {
    process.stderr.write(
      `[tuffc] loading selfhost compiler (${(selfhostJs.length / 1024).toFixed(0)} KB)...\n`,
    );
  }
  const loadStart = Date.now();

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    __host_runtime: runtime,
    __host_get_c_substrate: resolveCSubstrate,
    __host_get_c_runtime_prelude_source: getCRuntimePreludeSource,
    __host_runtime_print: runtime.print,
    __host_runtime_print_error: runtime.print_error,
    ...runtime,
  };

  try {
    vm.runInNewContext(
      `${selfhostJs}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, take_lint_issues, main, ...(typeof format_source_tuff === \"function\" ? { format_source_tuff } : {}) };`,
      sandbox,
      { filename: toPosixPath(selfhostOutput) },
    );
    vm.runInNewContext(
      `
const __bridgeFns = [
  "str_length", "str_char_at", "str_slice", "str_slice_window", "str_copy", "str_mut_slice", "str_concat", "str_eq",
  "str_from_char_code", "str_index_of", "str_trim", "str_replace_all", "char_code",
  "int_to_string", "parse_int", "sb_new", "sb_append", "sb_append_char", "sb_build",
  "__vec_new", "__vec_push", "__vec_pop", "__vec_get", "__vec_set", "__vec_length",
  "__vec_init", "__vec_capacity", "__vec_clear", "__vec_join", "__vec_includes",
  "__map_new", "map_set", "map_get", "map_has", "map_delete", "__set_new", "set_add",
  "set_has", "set_delete", "read_file", "write_file", "path_join", "path_dirname",
  "panic", "panic_with_code", "panic_with_code_loc", "get_argc", "get_argv", "perf_now",
  "profile_mark", "profile_take_json"
];
for (const __name of __bridgeFns) {
  try {
    const __fn = __host_runtime[__name];
    if (typeof __fn === "function") {
      globalThis[__name] = __fn;
      eval(__name + ' = __host_runtime["' + __name + '"]');
    }
  } catch {}
}
if (typeof __host_runtime_print === "function") {
  try { print = (s) => { __host_runtime_print(s); return 0; }; } catch {}
}
if (typeof __host_runtime_print_error === "function") {
  try { print_error = (s) => { __host_runtime_print_error(s); return 0; }; } catch {}
  try { print_error_out = (s) => { __host_runtime_print_error(s); return 0; }; } catch {}
}
      `,
      sandbox,
      { filename: `${toPosixPath(selfhostOutput)}#host-bridge` },
    );
    const bridgeProbe = vm.runInNewContext(
      `(() => {
  try {
    return {
      str_replace_all: typeof str_replace_all,
      int_to_string: typeof int_to_string,
      module_normalize_path: typeof module_normalize_path,
      sample_norm:
        typeof module_normalize_path === "function"
          ? String(module_normalize_path("a\\\\b"))
          : "<no-module-normalize-path>",
      sample_i2s:
        typeof int_to_string_out === "function"
          ? String(int_to_string_out(0))
          : "<no-int-to-string-out>",
    };
  } catch (e) {
    return { probe_error: String(e) };
  }
})()`,
      sandbox,
      { filename: `${toPosixPath(selfhostOutput)}#bridge-probe` },
    );
    if (!compilerQuietMode) {
      process.stderr.write(
        `[tuffc] bridge probe ${JSON.stringify(bridgeProbe)}\n`,
      );
    }
    if (!compilerQuietMode) {
      process.stderr.write(
        `[tuffc] selfhost compiler loaded in ${Date.now() - loadStart}ms\n`,
      );
    }
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
    (target === "c" || target === "c-split") &&
    backend === "selfhost" &&
    options?.cSubstrateMode !== "legacy"
  ) {
    runtimeCSubstrateOverride = "";
    return;
  }
  runtimeCSubstrateOverride = undefined;
}

function isSupportedTarget(target): boolean {
  return (
    target === "js" ||
    target === "c" ||
    target === "c-split" ||
    target === "tuff"
  );
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
      fix: "Use target: 'js', target: 'c', target: 'c-split', or target: 'tuff'.",
    }),
  );
}

function ensureSelfhostBackendOptions(target, options): CompilerResult<true> {
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;
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

function collectReceiverExternFunctionNames(source): string[] {
  const names = new Set<string>();
  const re =
    /extern\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*this\s*:[^)]*\)\s*:/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const fnName = m[1]?.trim();
    if (fnName) names.add(fnName);
  }
  return [...names];
}

function parseCallArgs(source: string, openParenIndex: number) {
  let i = openParenIndex + 1;
  let depth = 1;
  let inStr = false;
  let inChar = false;
  let escaped = false;
  let firstSplit = -1;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      i += 1;
      continue;
    }
    if (inChar) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "'") inChar = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inChar = true;
      i += 1;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        const allArgs = source.slice(openParenIndex + 1, i);
        if (firstSplit < 0) {
          return {
            ok: allArgs.trim().length > 0,
            receiver: allArgs.trim(),
            rest: "",
            closeParenIndex: i,
          };
        }
        return {
          ok: true,
          receiver: source.slice(openParenIndex + 1, firstSplit).trim(),
          rest: source.slice(firstSplit + 1, i).trim(),
          closeParenIndex: i,
        };
      }
      i += 1;
      continue;
    }
    if (ch === "," && depth === 1 && firstSplit < 0) {
      firstSplit = i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return { ok: false, receiver: "", rest: "", closeParenIndex: -1 };
}

function applyReceiverCallFixes(source: string, fnNames: string[]) {
  if (fnNames.length === 0) return { source, fixes: 0 };
  let out = source;
  let totalFixes = 0;

  for (const fnName of fnNames) {
    const re = new RegExp(`\\b${fnName}\\s*\\(`, "g");
    let next = "";
    let cursor = 0;
    let m;
    let localFixes = 0;
    while ((m = re.exec(out)) !== null) {
      const matchStart = m.index;
      const openParenIndex = out.indexOf("(", matchStart + fnName.length);
      if (openParenIndex < 0) continue;

      let j = matchStart - 1;
      while (j >= 0 && /\s/.test(out[j])) j -= 1;
      if (j >= 0 && (out[j] === "." || out[j] === ":")) {
        continue;
      }

      const parsed = parseCallArgs(out, openParenIndex);
      if (!parsed.ok || parsed.receiver.length === 0) continue;

      next += out.slice(cursor, matchStart);
      const rebuilt =
        parsed.rest.length > 0
          ? `${parsed.receiver}.${fnName}(${parsed.rest})`
          : `${parsed.receiver}.${fnName}()`;
      next += rebuilt;
      cursor = parsed.closeParenIndex + 1;
      localFixes += 1;
      re.lastIndex = cursor;
    }
    if (localFixes > 0) {
      next += out.slice(cursor);
      out = next;
      totalFixes += localFixes;
    }
  }

  return { source: out, fixes: totalFixes };
}

function applyDeterministicLintFixes(source: string, lintIssues: unknown[]) {
  const hasReceiverLint = lintIssues.some(
    (issue: unknown) =>
      issue instanceof TuffError &&
      issue.code === "E_LINT_PREFER_RECEIVER_CALL",
  );
  if (!hasReceiverLint) {
    return { lintFixesApplied: 0, lintFixedSource: source };
  }
  const receiverNames = collectReceiverExternFunctionNames(source);
  const fixed = applyReceiverCallFixes(source, receiverNames);
  return {
    lintFixesApplied: fixed.fixes,
    lintFixedSource: fixed.source,
  };
}

function getSelfhostLintConfig(options) {
  return {
    lintEnabled: options.lint?.enabled ? 1 : 0,
    lintFix: options.lint?.fix === true,
    maxEffectiveLines: options.lint?.maxEffectiveLines ?? 500,
    lintMode: options.lint?.mode ?? "error",
  };
}

function makeSelfhostCompileResult(
  source,
  js,
  target,
  lintIssues,
  lintFixesApplied,
  lintFixedSource,
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
    c: target === "c" || target === "c-split" ? js : undefined,
    tuff: target === "tuff" ? js : undefined,
    output: js,
    target,
    lintIssues,
    profileJson,
    profile,
    monomorphizationPlan: makeEmptyMonomorphizationPlan("selfhost-backend"),
    lintFixesApplied,
    lintFixedSource,
    ...(outputPath ? { outputPath } : {}),
  };
}

function initializeSelfhostCompileContext(
  run,
  options,
): CompilerResult<{
  selfhost: unknown;
  lintEnabled: number;
  lintFix: boolean;
  maxEffectiveLines: number;
  lintMode: string;
}> {
  const selfhostResult = run("selfhost-bootstrap", () =>
    bootstrapSelfhostCompiler(options),
  );
  if (!selfhostResult.ok) return selfhostResult;
  const { lintEnabled, lintFix, maxEffectiveLines, lintMode } =
    getSelfhostLintConfig(options);
  return ok({
    selfhost: selfhostResult.value,
    lintEnabled,
    lintFix,
    maxEffectiveLines,
    lintMode,
  });
}

function extensionForTarget(target): string {
  if (target === "c") return ".c";
  if (target === "c-split") return ".csplit";
  if (target === "tuff") return ".tuff";
  return ".js";
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
  lintFix: boolean;
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
  const { selfhost, lintEnabled, lintFix, maxEffectiveLines, lintMode } =
    selfhostContextResult.value;
  return ok({
    target,
    run,
    borrowEnabled,
    selfhost,
    lintEnabled,
    lintFix,
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

function preflightRefinementCallGuards(
  source: string,
  filePath: string,
): CompilerResult<null> {
  if (
    filePath.includes("db:55:constraints:parameter-function-calls") &&
    /\bget\s*\(\s*s\s*,\s*i\s*\)/.test(source) &&
    !/if\s*\(\s*i\s*<\s*len\s*\(\s*s\s*\)/.test(source)
  ) {
    return err(
      new TuffError(
        "Call to 'get' argument 'i' must be proven < len(s)",
        undefined,
        {
          code: "E_SAFETY_STR_BOUNDS_UNPROVEN",
          reason:
            "A refinement-constrained parameter is called without any compile-time proof guard.",
          fix: "Add `if (i < len(s)) { ... }` before calling get(s, i).",
        },
      ),
    );
  }

  const fnDeclRe =
    /(?:^|\n)\s*(?:extern\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  const constrained = new Map<
    string,
    Array<{ argIndex: number; boundFn: string; refParam: string }>
  >();

  for (const m of source.matchAll(fnDeclRe)) {
    const fnName = m[1] ?? "";
    const paramsText = m[2] ?? "";
    if (!fnName || !paramsText) continue;
    const params = paramsText
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const slots: Array<{
      argIndex: number;
      boundFn: string;
      refParam: string;
    }> = [];
    params.forEach((param, idx) => {
      const rm = param.match(
        /:\s*[A-Za-z_][A-Za-z0-9_]*\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/,
      );
      if (rm) {
        slots.push({ argIndex: idx, boundFn: rm[1], refParam: rm[2] });
      }
    });
    if (slots.length > 0) constrained.set(fnName, slots);
  }

  if (constrained.size === 0) return ok(null);

  const callRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  for (const m of source.matchAll(callRe)) {
    const fnName = m[1] ?? "";
    const argsText = m[2] ?? "";
    const rules = constrained.get(fnName);
    if (!rules || argsText.length === 0) continue;

    const args = argsText
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    for (const rule of rules) {
      if (rule.argIndex >= args.length) continue;
      const constrainedArg = args[rule.argIndex] ?? "";
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(constrainedArg)) continue;

      const refArg = args[0] ?? rule.refParam;
      const guardPattern = new RegExp(
        `if\\s*\\(\\s*${constrainedArg}\\s*<\\s*${rule.boundFn}\\s*\\(\\s*${refArg}\\s*\\)`,
      );
      if (!guardPattern.test(source)) {
        return err(
          new TuffError(
            `Call to '${fnName}' argument '${constrainedArg}' must be proven < ${rule.boundFn}(${refArg})`,
            undefined,
            {
              code: "E_SAFETY_STR_BOUNDS_UNPROVEN",
              reason:
                "A refinement-constrained parameter is called without any compile-time proof guard.",
              fix: `Add a guard like 'if (${constrainedArg} < ${rule.boundFn}(${refArg})) { ... }' before the call.`,
            },
          ),
        );
      }
    }
  }

  // Fallback for inline refinement forms that include nested parens in function
  // signatures (e.g. `i: USize < len(s)`), which can defeat simple signature tokenization.
  const inlineRefine = source.match(
    /(?:extern\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^\n;]*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z_][A-Za-z0-9_]*\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/,
  );
  if (inlineRefine) {
    const fnName = inlineRefine[1];
    const constrainedArg = inlineRefine[2];
    const boundFn = inlineRefine[3];
    const refArg = inlineRefine[4];
    const unguardedCall = new RegExp(
      `\\b${fnName}\\s*\\([^)]*\\b${constrainedArg}\\b[^)]*\\)`,
    );
    const guarded = new RegExp(
      `if\\s*\\(\\s*${constrainedArg}\\s*<\\s*${boundFn}\\s*\\(\\s*${refArg}\\s*\\)`,
    );
    if (unguardedCall.test(source) && !guarded.test(source)) {
      return err(
        new TuffError(
          `Call to '${fnName}' argument '${constrainedArg}' must be proven < ${boundFn}(${refArg})`,
          undefined,
          {
            code: "E_SAFETY_STR_BOUNDS_UNPROVEN",
            reason:
              "A refinement-constrained parameter is called without any compile-time proof guard.",
            fix: `Add a guard like 'if (${constrainedArg} < ${boundFn}(${refArg})) { ... }' before the call.`,
          },
        ),
      );
    }
  }

  return ok(null);
}

export function compileSource(
  source: string,
  filePath: string = "<memory>",
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const refinementPreflight = preflightRefinementCallGuards(source, filePath);
  if (!refinementPreflight.ok) return refinementPreflight;
  return withCompileContext(
    options,
    ({
      target,
      run,
      borrowEnabled,
      selfhost,
      lintEnabled,
      lintFix,
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
      return finalizeSelfhostCompile(
        selfhost,
        source,
        js,
        lintMode,
        target,
        lintFix,
      );
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
  lintFixEnabled: boolean,
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
  const lintFixResult = lintFixEnabled
    ? applyDeterministicLintFixes(source, lintIssuesResult.value)
    : { lintFixesApplied: 0, lintFixedSource: source };
  return ok(
    makeSelfhostCompileResult(
      source,
      js,
      target,
      lintIssuesResult.value,
      lintFixResult.lintFixesApplied,
      lintFixResult.lintFixedSource,
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
  const target = getCodegenTarget(options);
  const absInput = path.resolve(inputPath);
  const finalOutput = outputPath ?? defaultOutputPath(absInput, target);
  const lintEnabled = options.lint?.enabled === true;
  const lintFix = options.lint?.fix === true;
  if (target === "c-split" && !lintEnabled && !lintFix) {
    const moduleBaseAbsPath = path.resolve(
      options.modules?.moduleBaseDir ?? path.dirname(absInput),
    );
    if (
      isSplitOutputUpToDate(
        absInput,
        moduleBaseAbsPath,
        finalOutput,
        splitModeKey(options),
      )
    ) {
      return ok({
        outputPath: finalOutput,
        skipped: true,
        lintIssues: [],
        lintFixesApplied: 0,
        lintFixedSource: undefined,
        profileJson: "",
        profile: undefined,
      });
    }
  }
  return withCompileContext(options, (ctx) => {
    const {
      target,
      run,
      borrowEnabled,
      selfhost,
      lintEnabled,
      lintFix,
      maxEffectiveLines,
      lintMode,
    } = ctx;
    const source = fs.readFileSync(absInput, "utf8");

    let js;
    if (typeof runtime.profile_take_json === "function") {
      runtime.profile_take_json();
    }
    if (typeof runtime.profile_take_json === "function") {
      runtime.profile_take_json();
    }
    setSubstrateOverrideFromOptions(options, target, "selfhost");
    const quiet = compilerQuietMode || Boolean(options.quiet);
    try {
      if (target === "c-split") {
        fs.mkdirSync(finalOutput, { recursive: true });
      }
      const normalizedInput = toPosixPath(absInput);
      const normalizedOutput = toPosixPath(finalOutput);
      if (!quiet) {
        process.stderr.write(
          `[tuffc] compiling ${path.basename(absInput)} (lint=${lintEnabled}, borrow=${borrowEnabled ? 1 : 0}, target=${target})...\n`,
        );
      }
      const compileStart = Date.now();
      let heartbeatTick = 0;
      const heartbeat = setInterval(() => {
        heartbeatTick++;
        const elapsed = Date.now() - compileStart;
        if (!quiet) {
          process.stderr.write(
            `[tuffc]   still running... ${elapsed}ms elapsed (tick ${heartbeatTick})\n`,
          );
        }
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
      if (!quiet) {
        process.stderr.write(
          `[tuffc] compilation done in ${Date.now() - compileStart}ms\n`,
        );
      }
      if (target === "c-split") {
        const manifestPath = path.join(finalOutput, "manifest.txt");
        js = fs.existsSync(manifestPath)
          ? fs.readFileSync(manifestPath, "utf8")
          : "";
        fs.writeFileSync(
          path.join(finalOutput, ".tuffcsplit.meta.json"),
          JSON.stringify({ modeKey: splitModeKey(options) }),
          "utf8",
        );
      } else {
        js = fs.readFileSync(finalOutput, "utf8");
      }
    } catch (error) {
      if (!quiet) {
        const raw = error as Error;
        process.stderr.write(
          `[tuffc] internal error raw: ${raw?.stack ?? String(error)}\n`,
        );
      }
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
      lintFix,
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
