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
import { autoFixProgram, lintProgram } from "./linter.ts";
import { generateJavaScript } from "./codegen-js.ts";
import { generateC } from "./codegen-c.ts";
import { TuffError, enrichError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";
import * as runtime from "./runtime.ts";

type CompilerResult<T> = Result<T, TuffError>;

let cachedSelfhost = undefined;

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
    enableModules: true,
    modules: { moduleBaseDir: path.dirname(selfhostEntry) },
    typecheck: {
      ...(options.typecheck ?? {}),
      strictSafety: false,
    },
    resolve: {
      ...(options.resolve ?? {}),
      hostBuiltins: Object.keys(runtime),
      allowHostPrefix: "",
    },
    lint: { enabled: false },
    borrowcheck: { enabled: false },
  });

  if (!stage0Result.ok) return stage0Result;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  vm.runInNewContext(
    `${stage0Result.value.js}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, main };`,
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

function isSupportedTarget(target): boolean {
  return target === "js" || target === "c";
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

function runBorrowPrecheckSource(
  source,
  filePath,
  options,
): CompilerResult<void> {
  if (options.borrowcheck?.enabled === false) return ok(undefined);
  const tokensResult = lex(source, filePath);
  if (!tokensResult.ok) return tokensResult;
  const cstResult = parse(tokensResult.value);
  if (!cstResult.ok) return cstResult;
  const core = desugar(cstResult.value);
  const resolveResult = resolveNames(core, options.resolve ?? {});
  if (!resolveResult.ok) return resolveResult;
  const typecheckResult = typecheck(core, options.typecheck ?? {});
  if (!typecheckResult.ok) return typecheckResult;
  const borrowResult = borrowcheck(core, options.borrowcheck ?? {});
  if (!borrowResult.ok) return borrowResult;
  return ok(undefined);
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

function modulePathToFile(modulePath, moduleBaseDir) {
  return path.join(moduleBaseDir, ...modulePath.split("::")) + ".tuff";
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
      const depFile = modulePathToFile(imp.modulePath, moduleBaseDir);
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
  if (!isSupportedTarget(target)) {
    return err(
      new TuffError(`Unsupported codegen target: ${target}`, undefined, {
        code: "E_UNSUPPORTED_TARGET",
        reason:
          "The compiler was asked to emit code for a target that is not implemented.",
        fix: "Use target: 'js' or target: 'c'.",
      }),
    );
  }

  if ((options.backend ?? "stage0") === "selfhost") {
    const borrowEnabled = options.borrowcheck?.enabled !== false;

    if (target !== "js") {
      return err(
        new TuffError(
          `Selfhost backend does not support target '${target}' yet`,
          undefined,
          {
            code: "E_SELFHOST_UNSUPPORTED_OPTION",
            reason:
              "Selfhost backend currently emits JavaScript only and cannot generate other targets.",
            fix: "Use backend: 'stage0' for target 'c', or set target: 'js' when using selfhost.",
          },
        ),
      );
    }

    if (options.lint?.fix) {
      return err(
        new TuffError(
          "Selfhost backend does not support lint auto-fix yet",
          undefined,
          {
            code: "E_SELFHOST_UNSUPPORTED_OPTION",
            reason:
              "Selfhost backend currently supports strict file-length lint checks but not source auto-fix rewriting.",
            fix: "Use backend: 'stage0' with --lint-fix, or disable lint auto-fix in selfhost mode.",
          },
        ),
      );
    }

    if (borrowEnabled) {
      const precheck = runBorrowPrecheckSource(source, filePath, options);
      if (!precheck.ok) {
        enrichError(precheck.error, { source });
        return precheck;
      }
    }

    const selfhostResult = bootstrapSelfhostCompiler(options);
    if (!selfhostResult.ok) return selfhostResult;
    const selfhost = selfhostResult.value;
    const strictSafety = options.typecheck?.strictSafety ? 1 : 0;
    const lintEnabled =
      options.lint?.enabled && options.lint?.mode !== "warn" ? 1 : 0;
    const maxEffectiveLines = options.lint?.maxEffectiveLines ?? 500;

    // Selfhost can throw, wrap in try/catch but return Result
    let js;
    try {
      js =
        typeof selfhost.compile_source_with_options === "function"
          ? selfhost.compile_source_with_options(
              source,
              strictSafety,
              lintEnabled,
              maxEffectiveLines,
            )
          : selfhost.compile_source(source);
    } catch (error) {
      const enriched = enrichError(error, { source });
      return err(
        enriched instanceof TuffError
          ? enriched
          : new TuffError(String(error), undefined),
      );
    }
    return ok({
      tokens: [],
      cst: { kind: "Program", body: [] },
      core: { kind: "Program", body: [] },
      js,
      output: js,
      target,
      lintIssues: [],
      lintFixesApplied: 0,
      lintFixedSource: source,
    });
  }

  const run = createTracer(options.tracePasses);
  const borrowEnabled = options.borrowcheck?.enabled !== false;
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
  const { applied: lintFixesApplied, fixedSource: lintFixedSource } =
    autoFixProgram(core, {
      ...(options.lint ?? {}),
      source,
    });
  const lintIssues = lintProgram(core, {
    ...(options.lint ?? {}),
    source,
    filePath,
  });
  for (const issue of lintIssues) {
    enrichError(issue, { source });
  }
  const lintMode = options.lint?.mode ?? "error";
  if (lintIssues.length > 0 && lintMode !== "warn") {
    return err(lintIssues[0]);
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
    tokens,
    cst,
    core,
    js: target === "js" ? output : undefined,
    c: target === "c" ? output : undefined,
    output,
    target,
    lintIssues,
    lintFixesApplied,
    lintFixedSource,
  });
}

function compileFileInternal(
  inputPath: string,
  outputPath: string | undefined = undefined,
  options: Record<string, unknown> = {},
): CompilerResult<Record<string, unknown>> {
  const isSelfhostBootstrapInput =
    path.resolve(inputPath) === path.resolve(getSelfhostEntryPath());
  const target = getCodegenTarget(options);
  if (!isSupportedTarget(target)) {
    return err(
      new TuffError(`Unsupported codegen target: ${target}`, undefined, {
        code: "E_UNSUPPORTED_TARGET",
        reason:
          "The compiler was asked to emit code for a target that is not implemented.",
        fix: "Use target: 'js' or target: 'c'.",
      }),
    );
  }

  if ((options.backend ?? "stage0") === "selfhost") {
    const borrowEnabled =
      options.borrowcheck?.enabled !== false && !isSelfhostBootstrapInput;

    if (target !== "js") {
      return err(
        new TuffError(
          `Selfhost backend does not support target '${target}' yet`,
          undefined,
          {
            code: "E_SELFHOST_UNSUPPORTED_OPTION",
            reason:
              "Selfhost backend currently emits JavaScript only and cannot generate other targets.",
            fix: "Use backend: 'stage0' for target 'c', or set target: 'js' when using selfhost.",
          },
        ),
      );
    }

    const absInput = path.resolve(inputPath);
    const finalOutput = outputPath ?? defaultOutputPath(absInput, target);

    const selfhostResult = bootstrapSelfhostCompiler(options);
    if (!selfhostResult.ok) return selfhostResult;
    const selfhost = selfhostResult.value;

    if (options.lint?.fix) {
      return err(
        new TuffError(
          "Selfhost backend does not support lint auto-fix yet",
          undefined,
          {
            code: "E_SELFHOST_UNSUPPORTED_OPTION",
            reason:
              "Selfhost backend currently supports strict file-length lint checks but not source auto-fix rewriting.",
            fix: "Use backend: 'stage0' with --lint-fix, or disable lint auto-fix in selfhost mode.",
          },
        ),
      );
    }

    const strictSafety = options.typecheck?.strictSafety ? 1 : 0;
    const lintEnabled =
      options.lint?.enabled && options.lint?.mode !== "warn" ? 1 : 0;
    const maxEffectiveLines = options.lint?.maxEffectiveLines ?? 500;

    let js;
    try {
      if (options.enableModules) {
        const graphResult = loadModuleGraph(absInput, {
          ...(options.modules ?? {}),
          allowImportCycles: false,
        });
        if (!graphResult.ok) return graphResult;

        const resolveResult = resolveNames(graphResult.value.merged, {
          ...(options.resolve ?? {}),
          strictModuleImports: options.resolve?.strictModuleImports ?? true,
          moduleImportsByPath: graphResult.value.moduleImportsByPath,
        });
        if (!resolveResult.ok) return resolveResult;

        const typecheckResult = typecheck(
          graphResult.value.merged,
          options.typecheck ?? {},
        );
        if (!typecheckResult.ok) return typecheckResult;

        if (borrowEnabled) {
          const borrowResult = borrowcheck(
            graphResult.value.merged,
            options.borrowcheck ?? {},
          );
          if (!borrowResult.ok) return borrowResult;
        }

        const normalizedInput = toPosixPath(absInput);
        const normalizedOutput = toPosixPath(finalOutput);
        if (typeof selfhost.compile_file_with_options === "function") {
          selfhost.compile_file_with_options(
            normalizedInput,
            normalizedOutput,
            strictSafety,
            lintEnabled,
            maxEffectiveLines,
          );
        } else {
          selfhost.compile_file(normalizedInput, normalizedOutput);
        }
        js = fs.readFileSync(finalOutput, "utf8");
      } else {
        const source = fs.readFileSync(absInput, "utf8");
        if (borrowEnabled) {
          const precheck = runBorrowPrecheckSource(source, absInput, options);
          if (!precheck.ok) return precheck;
        }
        js =
          typeof selfhost.compile_source_with_options === "function"
            ? selfhost.compile_source_with_options(
                source,
                strictSafety,
                lintEnabled,
                maxEffectiveLines,
              )
            : selfhost.compile_source(source);
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
    }

    return ok({
      source: fs.readFileSync(absInput, "utf8"),
      tokens: [],
      cst: { kind: "Program", body: [] },
      core: { kind: "Program", body: [] },
      js,
      output: js,
      target,
      lintIssues: [],
      lintFixesApplied: 0,
      lintFixedSource: undefined,
      outputPath: finalOutput,
    });
  }

  const run = createTracer(options.tracePasses);
  const borrowEnabled =
    options.borrowcheck?.enabled !== false && !isSelfhostBootstrapInput;
  const useModules = !!options.enableModules;
  let graph = undefined;
  const lintMode = options.lint?.mode ?? "error";
  const allowImportCycles =
    options.lint?.enabled === true && lintMode === "warn";

  if (useModules) {
    const graphResult = run("load-module-graph", () =>
      loadModuleGraph(inputPath, {
        ...(options.modules ?? {}),
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
      typecheck(graph.merged, options.typecheck ?? {}),
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
    const mergedSource = graph.ordered.map((unit) => unit.source).join("\n\n");
    const { applied: lintFixesApplied, fixedSource: lintFixedSource } =
      autoFixProgram(graph.merged, {
        ...(options.lint ?? {}),
        source: mergedSource,
      });
    const sourceByFile = new Map();
    for (const unit of graph.ordered) {
      sourceByFile.set(unit.filePath, unit.source);
    }
    const lintIssues = lintProgram(graph.merged, {
      ...(options.lint ?? {}),
      sourceByFile,
      moduleImportCycles: graph.moduleImportCycles,
    });
    for (const issue of lintIssues) {
      enrichError(issue, { sourceByFile });
    }
    if (lintIssues.length > 0 && lintMode !== "warn") {
      return err(lintIssues[0]);
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
      js: target === "js" ? output : undefined,
      c: target === "c" ? output : undefined,
      output,
      target,
      lintIssues,
      lintFixesApplied,
      lintFixedSource,
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
