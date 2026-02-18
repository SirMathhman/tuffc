// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { desugar } from "./desugar.ts";
import { resolveNames } from "./resolve.ts";
import { typecheck } from "./typecheck.ts";
import { borrowcheck } from "./borrowcheck.ts";
import { generateJavaScript } from "./codegen-js.ts";
import { generateC } from "./codegen-c.ts";
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

function getDefaultRuntimeAliases() {
  const base = {
    tuff_core: path.join(__runtimeRoot, "tuff-core"),
  };
  const byTarget = {
    c: {
      tuff_core: path.join(__runtimeRoot, "tuff-c"),
    },
    js: {
      tuff_core: path.join(__runtimeRoot, "tuff-js"),
    },
  };
  return { base, byTarget };
}

type CompilerResult<T> = Result<T, TuffError>;

function monomorphTypeKey(typeNode): string {
  if (!typeNode || typeof typeNode !== "object") return "Unknown";

  if (typeNode.kind === "NamedType") {
    const args = (typeNode.genericArgs ?? []).map((arg) =>
      monomorphTypeKey(arg),
    );
    if (args.length === 0) return typeNode.name ?? "Unknown";
    return `${typeNode.name ?? "Unknown"}<${args.join(",")}>`;
  }

  if (typeNode.kind === "PointerType") {
    const inner = monomorphTypeKey(typeNode.to);
    if (typeNode.move) return `*move ${inner}`;
    return typeNode.mutable ? `*mut ${inner}` : `*${inner}`;
  }

  if (typeNode.kind === "ArrayType") {
    const elem = monomorphTypeKey(typeNode.element);
    if (typeNode.init !== undefined && typeNode.total !== undefined) {
      const init =
        typeNode.init?.kind === "NumberLiteral"
          ? Number(typeNode.init.value)
          : "init";
      const total =
        typeNode.total?.kind === "NumberLiteral"
          ? Number(typeNode.total.value)
          : "length";
      return `[${elem};${init};${total}]`;
    }
    return `[${elem}]`;
  }

  if (typeNode.kind === "TupleType") {
    const members = (typeNode.members ?? []).map((m) => monomorphTypeKey(m));
    return `(${members.join(",")})`;
  }

  if (typeNode.kind === "RefinementType") {
    return monomorphTypeKey(typeNode.base);
  }

  if (typeNode.kind === "UnionType") {
    return `${monomorphTypeKey(typeNode.left)}|${monomorphTypeKey(typeNode.right)}`;
  }

  return "Unknown";
}

function sanitizeMonomorphToken(value: string): string {
  return String(value)
    .replaceAll("*move ", "pmove_")
    .replaceAll("*mut ", "pmut_")
    .replaceAll("*", "p_")
    .replaceAll("<", "_of_")
    .replaceAll(">", "")
    .replaceAll("[", "arr_")
    .replaceAll("]", "")
    .replaceAll("(", "tup_")
    .replaceAll(")", "")
    .replaceAll("|", "_or_")
    .replaceAll(";", "_")
    .replaceAll(",", "_")
    .replaceAll(" ", "_")
    .replaceAll(/[^A-Za-z0-9_]/g, "_")
    .replaceAll(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeMonomorphizedName(
  functionName: string,
  typeKeys: string[],
): string {
  const suffix = typeKeys
    .map((key) => sanitizeMonomorphToken(key))
    .filter((token) => token.length > 0)
    .join("__");
  return suffix.length > 0
    ? `__mono_${functionName}__${suffix}`
    : `__mono_${functionName}`;
}

function makeEmptyMonomorphizationPlan(reason = "no-stage0-ast") {
  return {
    available: false,
    reason,
    specializations: [],
    byFunction: {},
  };
}

function collectMonomorphizationPlan(program) {
  if (!program || program.kind !== "Program" || !Array.isArray(program.body)) {
    return makeEmptyMonomorphizationPlan("missing-program");
  }

  const genericFunctions = new Map();
  for (const node of program.body) {
    if (node?.kind !== "FnDecl") continue;
    const generics = node.generics ?? [];
    if (!Array.isArray(generics) || generics.length === 0) continue;
    genericFunctions.set(node.name, generics);
  }

  if (genericFunctions.size === 0) {
    return {
      available: true,
      reason: "no-generic-functions",
      specializations: [],
      byFunction: {},
    };
  }

  const specializations = [];
  const dedupe = new Set();

  const recordCall = (callExpr) => {
    if (!callExpr || callExpr.kind !== "CallExpr") return;
    if (callExpr.callee?.kind !== "Identifier") return;
    const fnName = callExpr.callee.name;
    const generics = genericFunctions.get(fnName);
    if (!generics || generics.length === 0) return;

    const resolvedTypeArgs =
      Array.isArray(callExpr.__resolvedTypeArgs) &&
      callExpr.__resolvedTypeArgs.length === generics.length
        ? callExpr.__resolvedTypeArgs
        : undefined;
    const explicitTypeArgs =
      Array.isArray(callExpr.typeArgs) &&
      callExpr.typeArgs.length === generics.length
        ? callExpr.typeArgs
        : undefined;
    const chosenTypeArgs = resolvedTypeArgs ?? explicitTypeArgs;
    if (!chosenTypeArgs) return;

    const typeKeys = chosenTypeArgs.map((typeArg) => monomorphTypeKey(typeArg));
    if (typeKeys.some((key) => !key || key === "Unknown")) return;

    const key = `${fnName}<${typeKeys.join(",")}>`;
    if (dedupe.has(key)) return;
    dedupe.add(key);

    specializations.push({
      key,
      functionName: fnName,
      typeArgs: typeKeys,
      mangledName: makeMonomorphizedName(fnName, typeKeys),
      source: resolvedTypeArgs ? "inferred" : "explicit",
    });
  };

  const visitExpr = (expr) => {
    if (!expr || typeof expr !== "object") return;
    if (expr.kind === "CallExpr") {
      recordCall(expr);
      visitExpr(expr.callee);
      for (const arg of expr.args ?? []) visitExpr(arg);
      for (const typeArg of expr.typeArgs ?? []) visitExpr(typeArg);
      for (const typeArg of expr.__resolvedTypeArgs ?? []) visitExpr(typeArg);
      return;
    }
    if (expr.kind === "BinaryExpr") {
      visitExpr(expr.left);
      visitExpr(expr.right);
      return;
    }
    if (expr.kind === "UnaryExpr") {
      visitExpr(expr.expr);
      return;
    }
    if (expr.kind === "MemberExpr") {
      visitExpr(expr.object);
      return;
    }
    if (expr.kind === "IndexExpr") {
      visitExpr(expr.target);
      visitExpr(expr.index);
      return;
    }
    if (expr.kind === "IfExpr") {
      visitExpr(expr.condition);
      visitNode(expr.thenBranch);
      visitNode(expr.elseBranch);
      return;
    }
    if (expr.kind === "MatchExpr") {
      visitExpr(expr.subject);
      for (const arm of expr.arms ?? []) {
        visitNode(arm.body);
      }
      return;
    }
    if (expr.kind === "StructInitExpr") {
      for (const field of expr.fields ?? []) {
        visitExpr(field.value);
      }
      for (const typeArg of expr.typeArgs ?? []) visitExpr(typeArg);
      return;
    }
    if (expr.kind === "TupleExpr") {
      for (const item of expr.items ?? []) visitExpr(item);
      return;
    }
    if (expr.kind === "Block") {
      visitNode(expr);
    }
  };

  const visitNode = (node) => {
    if (!node || typeof node !== "object") return;
    switch (node.kind) {
      case "Program":
        for (const stmt of node.body ?? []) visitNode(stmt);
        break;
      case "FnDecl":
      case "ClassFunctionDecl":
        visitNode(node.body);
        break;
      case "Block":
        for (const stmt of node.statements ?? []) visitNode(stmt);
        break;
      case "ExprStmt":
        visitExpr(node.expr);
        break;
      case "LetDecl":
        visitExpr(node.value);
        break;
      case "AssignStmt":
        visitExpr(node.target);
        visitExpr(node.value);
        break;
      case "ReturnStmt":
        visitExpr(node.value);
        break;
      case "IfStmt":
        visitExpr(node.condition);
        visitNode(node.thenBranch);
        visitNode(node.elseBranch);
        break;
      case "ForStmt":
        visitExpr(node.start);
        visitExpr(node.end);
        visitNode(node.body);
        break;
      case "WhileStmt":
        visitExpr(node.condition);
        visitNode(node.body);
        break;
      case "LoopStmt":
        visitNode(node.body);
        break;
      case "LifetimeStmt":
        visitNode(node.body);
        break;
      case "IntoStmt":
      case "DropStmt":
        visitExpr(node.target);
        break;
      default:
        break;
    }
  };

  visitNode(program);

  const byFunction = {};
  for (const specialization of specializations) {
    if (!byFunction[specialization.functionName]) {
      byFunction[specialization.functionName] = [];
    }
    byFunction[specialization.functionName].push(specialization);
  }

  return {
    available: true,
    reason: "stage0-ast",
    specializations,
    byFunction,
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

  const stage0Result = compileFileInternal(selfhostEntry, selfhostOutput, {
    ...options,
    backend: "stage0",
    target: "js",
    enableModules: true,
    modules: { moduleBaseDir: path.dirname(selfhostEntry) },
    resolve: {
      ...(options.resolve ?? {}),
      hostBuiltins: Object.keys(runtime),
      allowHostPrefix: "",
    },
    lint: { enabled: false },
    // Bootstrap compiles the compiler implementation itself, which is not yet
    // fully annotated for always-on safety proofs.
    typecheck: { ...(options.typecheck ?? {}), __bootstrapRelaxed: true },
    borrowcheck: { enabled: false },
  });

  if (!stage0Result.ok) return stage0Result;

  const hostEmitTargetFromSource = (
    source,
    target,
    filePath = "<selfhost>",
  ) => {
    const normalizedTarget = typeof target === "string" ? target : "js";
    const stage0Compile = compileSource(source, filePath, {
      backend: "stage0",
      target: normalizedTarget,
      lint: { enabled: false },
      typecheck: { strictSafety: false, __bootstrapRelaxed: true },
      borrowcheck: { enabled: true },
    });
    if (!stage0Compile.ok) {
      throw stage0Compile.error;
    }
    return stage0Compile.value.output;
  };

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    __host_emit_target_from_source: hostEmitTargetFromSource,
    __host_get_c_substrate: resolveCSubstrate,
    __host_get_c_runtime_prelude_source: getCRuntimePreludeSource,
    ...runtime,
  };

  vm.runInNewContext(
    `${stage0Result.value.js}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, take_lint_issues, main };`,
    sandbox,
    { filename: toPosixPath(selfhostOutput) },
  );

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

  // Migration step: default selfhost C emission to substrate-free mode so
  // runtime behavior comes from Tuff-authored prelude/modules, not src/main/c.
  // Stage0/native legacy paths remain unchanged unless explicitly overridden.
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

function selectBackendWithTargetCheck(
  options,
  target,
  isSelfhostBootstrapInput = false,
): CompilerResult<string> {
  const selectedBackend = selectBackend(
    options,
    target,
    isSelfhostBootstrapInput,
  );
  const targetCheck = ensureSupportedTarget(target);
  if (!targetCheck.ok) return targetCheck;
  return ok(selectedBackend);
}

function isBorrowcheckEnabled(options, disableForBootstrap = false) {
  if (disableForBootstrap) return false;
  return options.borrowcheck?.enabled !== false;
}

function selectBackend(options, target, isSelfhostBootstrapInput = false) {
  const explicit = options.backend;
  if (explicit === "stage0" || explicit === "selfhost") {
    return explicit;
  }

  // Selfhost compiler source itself must be compiled by Stage0 bootstrap.
  if (isSelfhostBootstrapInput) {
    return "stage0";
  }

  // Remaining intentional Stage0 ownership after selfhost-first migration:
  // 1) Bootstrap seed for selfhost.tuff (isSelfhostBootstrapInput)

  // Default: selfhost-first compilation for all supported targets.
  return "selfhost";
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

function stage0LintUnsupportedError(): CompilerResult<never> {
  return err(
    new TuffError("Stage0 backend no longer supports linting", undefined, {
      code: "E_SELFHOST_UNSUPPORTED_OPTION",
      reason:
        "Linting is now provided only by the Tuff selfhost pipeline to keep diagnostics behavior unified.",
      fix: "Use backend: 'selfhost' (default) when enabling --lint.",
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

function makeSelfhostCompileResult(source, js, target, lintIssues, outputPath) {
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

function emitTarget(core, target): string {
  if (target === "c") {
    return generateC(core);
  }
  return generateJavaScript(core);
}

function gatherImports(program) {
  return program.body.filter((n) => n.kind === "ImportDecl");
}

function getDeclName(node) {
  if (!node) return undefined;
  if (
    [
      "FnDecl",
      "ClassFunctionDecl",
      "StructDecl",
      "EnumDecl",
      "ObjectDecl",
      "ContractDecl",
      "TypeAlias",
      "ExternFnDecl",
      "ExternLetDecl",
      "ExternTypeDecl",
      "LetDecl",
    ].includes(node.kind)
  ) {
    return node.name ?? undefined;
  }
  return undefined;
}

function normalizePackageAliases(moduleBaseDir, options = {}) {
  const target = options.target ?? "";
  const defaults = getDefaultRuntimeAliases();
  const byTarget = {
    ...(defaults.byTarget ?? {}),
    ...(options.packageAliasesByTarget ?? {}),
  };
  const aliases = {
    ...(defaults.base ?? {}),
    ...(byTarget[target] ?? {}),
    ...(options.packageAliases ?? {}),
    ...((options.packageAliasesByTarget ?? {})[target] ?? {}),
  };

  const normalized = {};
  for (const [alias, root] of Object.entries(aliases)) {
    if (typeof root !== "string" || root.length === 0) continue;
    normalized[String(alias)] = path.isAbsolute(root)
      ? root
      : path.resolve(moduleBaseDir, root);
  }
  return normalized;
}

function modulePathToFile(modulePath, moduleBaseDir, packageAliases = {}) {
  const parts = modulePath.split("::");
  const head = parts[0] ?? "";
  const tail = parts.slice(1);

  if (Object.prototype.hasOwnProperty.call(packageAliases, head)) {
    return path.join(packageAliases[head], ...tail) + ".tuff";
  }

  return path.join(moduleBaseDir, ...parts) + ".tuff";
}

function loadModuleGraph(
  entryPath,
  options = {},
): CompilerResult<{
  ordered: unknown[];
  merged: unknown;
  moduleImportsByPath: Map<string, Set<string>>;
  moduleImportCycles: string[][];
}> {
  const moduleBaseDir = options.moduleBaseDir ?? path.dirname(entryPath);
  const allowImportCycles = options.allowImportCycles ?? false;
  const packageAliases = normalizePackageAliases(moduleBaseDir, options);
  const seen = new Set();
  const visiting = new Set();
  const ordered = [];
  const moduleMetaByPath = new Map();
  const moduleImportCycles = [];
  const moduleImportCycleKeys = new Set();

  const visit = (filePath, trail = []): CompilerResult<void> => {
    const abs = path.resolve(filePath);
    if (seen.has(abs)) return ok(undefined);
    if (visiting.has(abs)) {
      const cycleStart = trail.indexOf(abs);
      const cycle =
        cycleStart >= 0 ? [...trail.slice(cycleStart), abs] : [...trail, abs];
      if (allowImportCycles) {
        const cycleKey = cycle.join(" -> ");
        if (!moduleImportCycleKeys.has(cycleKey)) {
          moduleImportCycleKeys.add(cycleKey);
          moduleImportCycles.push(cycle);
        }
        return ok(undefined);
      }
      return err(
        new TuffError(
          `Module import cycle detected: ${cycle.join(" -> ")}`,
          undefined,
          {
            code: "E_MODULE_CYCLE",
            reason:
              "The module dependency graph contains a cycle, so a topological compilation order cannot be established.",
            fix: "Break the cycle by moving shared declarations into a third module and import that module from each side.",
          },
        ),
      );
    }
    visiting.add(abs);

    let source: string;
    try {
      source = fs.readFileSync(abs, "utf8");
    } catch (e: unknown) {
      return err(
        new TuffError(
          `Cannot read module file: ${abs}`,
          trail.length > 0 ? { file: trail[trail.length - 1] } : undefined,
          {
            code: "E_MODULE_NOT_FOUND",
            reason:
              "The requested module file does not exist or cannot be read.",
            fix: "Verify the module path is correct and the file exists.",
            details: e instanceof Error ? e.message : String(e),
          },
        ),
      );
    }
    const tokensResult = lex(source, abs);
    if (!tokensResult.ok) return tokensResult;
    const tokens = tokensResult.value;
    const cstResult = parse(tokens);
    if (!cstResult.ok) return cstResult;
    const cst = cstResult.value;
    const core = desugar(cst);

    const declarations = new Set();
    const exported = new Set();
    for (const stmt of core.body) {
      const declName = getDeclName(stmt);
      if (!declName) continue;
      declarations.add(declName);
      if (stmt.exported === true) {
        exported.add(declName);
      }
    }

    moduleMetaByPath.set(abs, {
      declarations,
      exported,
      imports: gatherImports(core),
    });

    for (const imp of gatherImports(core)) {
      const depFile = modulePathToFile(
        imp.modulePath,
        moduleBaseDir,
        packageAliases,
      );
      const depAbs = path.resolve(depFile);
      const visitResult = visit(depFile, [...trail, abs]);
      if (!visitResult.ok) return visitResult;

      const depMeta = moduleMetaByPath.get(depAbs);
      if (!depMeta) continue;

      for (const importedName of imp.names ?? []) {
        if (depMeta.exported.has(importedName)) {
          continue;
        }
        if (depMeta.declarations.has(importedName)) {
          return err(
            new TuffError(
              `Cannot import '${importedName}' from ${imp.modulePath}: symbol is not exported with 'out'`,
              imp.loc ?? undefined,
              {
                code: "E_MODULE_PRIVATE_IMPORT",
                reason:
                  "A module import referenced a declaration that exists but is not visible outside its module.",
                fix: `Mark '${importedName}' as 'out' in ${imp.modulePath}, or stop importing it from this module.`,
              },
            ),
          );
        }
        return err(
          new TuffError(
            `Cannot import '${importedName}' from ${imp.modulePath}: exported symbol not found`,
            imp.loc ?? undefined,
            {
              code: "E_MODULE_UNKNOWN_EXPORT",
              reason:
                "A module import requested a symbol that is not exported by the target module.",
              fix: `Check the import list and module exports in ${imp.modulePath}.`,
            },
          ),
        );
      }
    }

    visiting.delete(abs);
    seen.add(abs);
    ordered.push({ filePath: abs, source, tokens, cst, core });
    return ok(undefined);
  };

  const visitResult = visit(entryPath);
  if (!visitResult.ok) return visitResult;

  const moduleImportsByPath = new Map();
  for (const [filePath, meta] of moduleMetaByPath.entries()) {
    const importedNames = new Set();
    for (const imp of meta.imports ?? []) {
      for (const name of imp.names ?? []) {
        importedNames.add(name);
      }
    }
    moduleImportsByPath.set(filePath, importedNames);
  }

  const merged = {
    kind: "Program",
    body: ordered.flatMap((unit) =>
      unit.core.body
        .filter((n) => n.kind !== "ImportDecl")
        .map((n) => ({ ...n, __modulePath: unit.filePath })),
    ),
  };

  return ok({ ordered, merged, moduleImportsByPath, moduleImportCycles });
}

export function compileSource(
  source: string,
  filePath: string = "<memory>",
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const target = getCodegenTarget(options);
  const selectedBackendResult = selectBackendWithTargetCheck(
    options,
    target,
    false,
  );
  if (!selectedBackendResult.ok) return selectedBackendResult;

  if (selectedBackendResult.value === "selfhost") {
    const run = createTracer(options.tracePasses);
    const borrowEnabled = isBorrowcheckEnabled(options);
    const selfhostOptionsCheck = ensureSelfhostBackendOptions(target, options);
    if (!selfhostOptionsCheck.ok) return selfhostOptionsCheck;

    const effectiveSource = source;
    const selfhostContextResult = initializeSelfhostCompileContext(
      run,
      options,
    );
    if (!selfhostContextResult.ok) return selfhostContextResult;
    const selfhostContext = selfhostContextResult.value;
    const selfhost = selfhostContext.selfhost;
    const strictSafety = selfhostContext.strictSafety;
    const lintEnabled = selfhostContext.lintEnabled;
    const maxEffectiveLines = selfhostContext.maxEffectiveLines;
    const lintMode = selfhostContext.lintMode;

    // Selfhost can throw, wrap in try/catch but return Result
    let js;
    setSubstrateOverrideFromOptions(options, target, "selfhost");
    try {
      js = run("selfhost-compile-source", () =>
        typeof selfhost.compile_source_with_options === "function"
          ? selfhost.compile_source_with_options(
              effectiveSource,
              strictSafety,
              lintEnabled,
              maxEffectiveLines,
              borrowEnabled ? 1 : 0,
              target,
            )
          : selfhost.compile_source(effectiveSource),
      );
    } catch (error) {
      const enriched = enrichError(error, { source: effectiveSource });
      return err(
        enriched instanceof TuffError
          ? enriched
          : new TuffError(String(error), undefined),
      );
    } finally {
      runtimeCSubstrateOverride = undefined;
    }
    const lintIssuesResult = handleSelfhostLintIssues(
      selfhost,
      effectiveSource,
      lintMode,
    );
    if (!lintIssuesResult.ok) return lintIssuesResult;
    const lintIssues = lintIssuesResult.value;

    return ok(makeSelfhostCompileResult(source, js, target, lintIssues));
  }

  if (options.lint?.enabled) {
    return stage0LintUnsupportedError();
  }

  const run = createTracer(options.tracePasses);
  const borrowEnabled = isBorrowcheckEnabled(options);
  const tokensResult = run("lex", () => lex(source, filePath));
  if (!tokensResult.ok) {
    enrichError(tokensResult.error, { source });
    return tokensResult;
  }
  const tokens = tokensResult.value;
  const cstResult = run("parse", () => parse(tokens));
  if (!cstResult.ok) {
    enrichError(cstResult.error, { source });
    return cstResult;
  }
  const cst = cstResult.value;
  const core = run("desugar", () => desugar(cst));
  const resolveResult = run("resolve", () =>
    resolveNames(core, options.resolve ?? {}),
  );
  if (!resolveResult.ok) {
    enrichError(resolveResult.error, { source });
    return resolveResult;
  }
  const typecheckResult = run("typecheck", () =>
    typecheck(core, options.typecheck ?? {}),
  );
  if (!typecheckResult.ok) {
    enrichError(typecheckResult.error, { source });
    return typecheckResult;
  }
  if (borrowEnabled) {
    const borrowResult = run("borrowcheck", () =>
      borrowcheck(core, options.borrowcheck ?? {}),
    );
    if (!borrowResult.ok) {
      enrichError(borrowResult.error, { source });
      return borrowResult;
    }
  }
  let output;
  try {
    output = run("codegen", () => emitTarget(core, target));
  } catch (error) {
    const enriched = enrichError(error, { source });
    return err(
      enriched instanceof TuffError
        ? enriched
        : new TuffError(String(error), undefined),
    );
  }

  return ok({
    monomorphizationPlan: collectMonomorphizationPlan(core),
    tokens,
    cst,
    core,
    js: target === "js" ? output : undefined,
    c: target === "c" ? output : undefined,
    output,
    target,
    lintIssues: [],
    lintFixesApplied: 0,
    lintFixedSource: source,
  });
}

function compileFileInternal(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const isSelfhostBootstrapInput =
    path.resolve(inputPath) === path.resolve(getSelfhostEntryPath());
  const typecheckOptions = isSelfhostBootstrapInput
    ? { ...(options.typecheck ?? {}), __bootstrapRelaxed: true }
    : (options.typecheck ?? {});
  const target = getCodegenTarget(options);
  const backendResult = selectBackendWithTargetCheck(
    options,
    target,
    isSelfhostBootstrapInput,
  );
  if (!backendResult.ok) return backendResult;
  const selectedBackend = backendResult.value;

  if (selectedBackend === "selfhost") {
    const run = createTracer(options.tracePasses);
    const borrowEnabled = isBorrowcheckEnabled(
      options,
      isSelfhostBootstrapInput,
    );
    const selfhostOptionsCheck = ensureSelfhostBackendOptions(target, options);
    if (!selfhostOptionsCheck.ok) return selfhostOptionsCheck;

    const absInput = path.resolve(inputPath);
    const finalOutput = outputPath ?? defaultOutputPath(absInput, target);
    const selfhostContextResult = initializeSelfhostCompileContext(
      run,
      options,
    );
    if (!selfhostContextResult.ok) return selfhostContextResult;
    const { selfhost, strictSafety, lintEnabled, maxEffectiveLines, lintMode } =
      selfhostContextResult.value;
    const source = fs.readFileSync(absInput, "utf8");

    let js;
    setSubstrateOverrideFromOptions(options, target, "selfhost");
    try {
      if (options.enableModules) {
        // Selfhost handles the full module pipeline: load, resolve, typecheck, codegen.
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

    const lintIssuesResult = handleSelfhostLintIssues(
      selfhost,
      source,
      lintMode,
    );
    if (!lintIssuesResult.ok) return lintIssuesResult;
    const lintIssues = lintIssuesResult.value;

    return ok(
      makeSelfhostCompileResult(source, js, target, lintIssues, finalOutput),
    );
  }

  if (options.lint?.enabled) {
    return stage0LintUnsupportedError();
  }

  const run = createTracer(options.tracePasses);
  const borrowEnabled = isBorrowcheckEnabled(options, isSelfhostBootstrapInput);
  const useModules = !!options.enableModules;
  let graph = undefined;
  const lintMode = options.lint?.mode ?? "error";
  const allowImportCycles =
    options.lint?.enabled === true && lintMode === "warn";

  if (useModules) {
    const graphResult = run("load-module-graph", () =>
      loadModuleGraph(inputPath, {
        ...(options.modules ?? {}),
        target,
        allowImportCycles,
      }),
    );
    if (!graphResult.ok) {
      const sourceByFile = new Map();
      if (fs.existsSync(inputPath)) {
        sourceByFile.set(
          path.resolve(inputPath),
          fs.readFileSync(inputPath, "utf8"),
        );
      }
      enrichError(graphResult.error, {
        sourceByFile,
        source: fs.existsSync(inputPath)
          ? fs.readFileSync(inputPath, "utf8")
          : undefined,
      });
      return graphResult;
    }
    graph = graphResult.value;
    const resolveResult = run("resolve", () =>
      resolveNames(graph.merged, {
        ...(options.resolve ?? {}),
        strictModuleImports: options.resolve?.strictModuleImports ?? true,
        moduleImportsByPath: graph.moduleImportsByPath,
      }),
    );
    if (!resolveResult.ok) {
      const sourceByFile = new Map();
      for (const unit of graph.ordered) {
        sourceByFile.set(unit.filePath, unit.source);
      }
      enrichError(resolveResult.error, { sourceByFile });
      return resolveResult;
    }
    const typecheckResult = run("typecheck", () =>
      typecheck(graph.merged, typecheckOptions),
    );
    if (!typecheckResult.ok) {
      const sourceByFile = new Map();
      for (const unit of graph.ordered) {
        sourceByFile.set(unit.filePath, unit.source);
      }
      enrichError(typecheckResult.error, { sourceByFile });
      return typecheckResult;
    }
    if (borrowEnabled) {
      const borrowResult = run("borrowcheck", () =>
        borrowcheck(graph.merged, options.borrowcheck ?? {}),
      );
      if (!borrowResult.ok) {
        const sourceByFile = new Map();
        for (const unit of graph.ordered) {
          sourceByFile.set(unit.filePath, unit.source);
        }
        enrichError(borrowResult.error, { sourceByFile });
        return borrowResult;
      }
    }
    let output;
    try {
      output = run("codegen", () => emitTarget(graph.merged, target));
    } catch (error) {
      const sourceByFile = new Map();
      for (const unit of graph.ordered) {
        sourceByFile.set(unit.filePath, unit.source);
      }
      const enriched = enrichError(error, { sourceByFile });
      return err(
        enriched instanceof TuffError
          ? enriched
          : new TuffError(String(error), undefined),
      );
    }

    const finalOutput = outputPath ?? defaultOutputPath(inputPath, target);
    fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
    fs.writeFileSync(finalOutput, output, "utf8");

    return ok({
      source: fs.readFileSync(inputPath, "utf8"),
      tokens: graph.ordered.at(-1)?.tokens ?? [],
      cst: graph.ordered.at(-1)?.cst ?? { kind: "Program", body: [] },
      core: graph.merged,
      monomorphizationPlan: collectMonomorphizationPlan(graph.merged),
      js: target === "js" ? output : undefined,
      c: target === "c" ? output : undefined,
      output,
      target,
      lintIssues: [],
      lintFixesApplied: 0,
      lintFixedSource: fs.readFileSync(inputPath, "utf8"),
      moduleGraph: graph,
      outputPath: finalOutput,
    });
  } else {
    const source = fs.readFileSync(inputPath, "utf8");
    const compileResult = compileSource(source, inputPath, options);
    if (!compileResult.ok) return compileResult;

    const finalOutput = outputPath ?? defaultOutputPath(inputPath, target);
    fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
    fs.writeFileSync(finalOutput, compileResult.value.output, "utf8");
    return ok({ ...compileResult.value, outputPath: finalOutput });
  }
}

export function compileFile(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  return compileFileInternal(inputPath, outputPath, options);
}

// Legacy throwing wrappers for backward compatibility
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

// Aliases for the old API names (for tests that import compileSourceResult/compileFileResult)
export const compileSourceResult = compileSource;
export const compileFileResult = compileFile;
