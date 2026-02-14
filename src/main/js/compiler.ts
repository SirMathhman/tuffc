import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { desugar } from "./desugar.ts";
import { resolveNames } from "./resolve.ts";
import { typecheck } from "./typecheck.ts";
import { autoFixProgram, lintProgram } from "./linter.ts";
import { generateJavaScript } from "./codegen-js.ts";
import { TuffError, enrichError, raise } from "./errors.ts";
import { err, ok } from "./result.ts";
import * as runtime from "./runtime.ts";

let cachedSelfhost = null;

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}

function getSelfhostEntryPath() {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "..", "tuff", "selfhost.tuff");
}

function bootstrapSelfhostCompiler(options = {}) {
  if (cachedSelfhost) return cachedSelfhost;

  const selfhostEntry = getSelfhostEntryPath();
  const selfhostOutput = path.join(
    path.dirname(selfhostEntry),
    "selfhost.generated.js",
  );

  const stage0Result = compileFile(selfhostEntry, selfhostOutput, {
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
  });

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  vm.runInNewContext(
    `${stage0Result.js}\nmodule.exports = { compile_source, compile_file, compile_source_with_options, compile_file_with_options, main };`,
    sandbox,
    { filename: toPosixPath(selfhostOutput) },
  );

  const compiled = sandbox.module.exports;
  if (
    typeof compiled?.compile_source !== "function" ||
    typeof compiled?.compile_file !== "function"
  ) {
    return raise(
      new TuffError(
        "Selfhost compiler bootstrap exports are incomplete",
        null,
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
  return cachedSelfhost;
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

function gatherImports(program) {
  return program.body.filter((n) => n.kind === "ImportDecl");
}

function getDeclName(node) {
  if (!node) return null;
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
    return node.name ?? null;
  }
  return null;
}

function modulePathToFile(modulePath, moduleBaseDir) {
  return path.join(moduleBaseDir, ...modulePath.split("::")) + ".tuff";
}

function loadModuleGraph(entryPath, options = {}) {
  const moduleBaseDir = options.moduleBaseDir ?? path.dirname(entryPath);
  const seen = new Set();
  const visiting = new Set();
  const ordered = [];
  const moduleMetaByPath = new Map();

  const visit = (filePath, trail = []) => {
    const abs = path.resolve(filePath);
    if (seen.has(abs)) return;
    if (visiting.has(abs)) {
      const cycleStart = trail.indexOf(abs);
      const cycle =
        cycleStart >= 0 ? [...trail.slice(cycleStart), abs] : [...trail, abs];
      return raise(
        new TuffError(
          `Module import cycle detected: ${cycle.join(" -> ")}`,
          null,
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

    const source = fs.readFileSync(abs, "utf8");
    const tokens = lex(source, abs);
    const cst = parse(tokens);
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
      visit(depFile, [...trail, abs]);

      const depMeta = moduleMetaByPath.get(depAbs);
      if (!depMeta) continue;

      for (const importedName of imp.names ?? []) {
        if (depMeta.exported.has(importedName)) {
          continue;
        }
        if (depMeta.declarations.has(importedName)) {
          return raise(
            new TuffError(
              `Cannot import '${importedName}' from ${imp.modulePath}: symbol is not exported with 'out'`,
              imp.loc ?? null,
              {
                code: "E_MODULE_PRIVATE_IMPORT",
                reason:
                  "A module import referenced a declaration that exists but is not visible outside its module.",
                fix: `Mark '${importedName}' as 'out' in ${imp.modulePath}, or stop importing it from this module.`,
              },
            ),
          );
        }
        return raise(
          new TuffError(
            `Cannot import '${importedName}' from ${imp.modulePath}: exported symbol not found`,
            imp.loc ?? null,
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
  };

  visit(entryPath);

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

  return { ordered, merged, moduleImportsByPath };
}

export function compileSource(source, filePath = "<memory>", options = {}) {
  if ((options.backend ?? "stage0") === "selfhost") {
    if (options.lint?.fix) {
      return raise(
        new TuffError(
          "Selfhost backend does not support lint auto-fix yet",
          null,
          {
            code: "E_SELFHOST_UNSUPPORTED_OPTION",
            reason:
              "Selfhost backend currently supports strict file-length lint checks but not source auto-fix rewriting.",
            fix: "Use backend: 'stage0' with --lint-fix, or disable lint auto-fix in selfhost mode.",
          },
        ),
      );
    }

    try {
      const selfhost = bootstrapSelfhostCompiler(options);
      const strictSafety = options.typecheck?.strictSafety ? 1 : 0;
      const lintEnabled =
        options.lint?.enabled && options.lint?.mode !== "warn" ? 1 : 0;
      const maxEffectiveLines = options.lint?.maxEffectiveLines ?? 500;
      const js =
        typeof selfhost.compile_source_with_options === "function"
          ? selfhost.compile_source_with_options(
              source,
              strictSafety,
              lintEnabled,
              maxEffectiveLines,
            )
          : selfhost.compile_source(source);
      return {
        tokens: [],
        cst: { kind: "Program", body: [] },
        core: { kind: "Program", body: [] },
        js,
        lintIssues: [],
        lintFixesApplied: 0,
        lintFixedSource: source,
      };
    } catch (error) {
      return raise(enrichError(error, { source }));
    }
  }

  const run = createTracer(options.tracePasses);
  try {
    const tokens = run("lex", () => lex(source, filePath));
    const cst = run("parse", () => parse(tokens));
    const core = run("desugar", () => desugar(cst));
    run("resolve", () => resolveNames(core, options.resolve ?? {}));
    run("typecheck", () => typecheck(core, options.typecheck ?? {}));
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
      return raise(lintIssues[0]);
    }
    const js = run("codegen", () => generateJavaScript(core));
    return {
      tokens,
      cst,
      core,
      js,
      lintIssues,
      lintFixesApplied,
      lintFixedSource,
    };
  } catch (error) {
    return raise(enrichError(error, { source }));
  }
}

export function compileFile(inputPath, outputPath = null, options = {}) {
  if ((options.backend ?? "stage0") === "selfhost") {
    const absInput = path.resolve(inputPath);
    const finalOutput = outputPath ?? absInput.replace(/\.tuff$/i, ".js");

    try {
      const selfhost = bootstrapSelfhostCompiler(options);
      if (options.lint?.fix) {
        return raise(
          new TuffError(
            "Selfhost backend does not support lint auto-fix yet",
            null,
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
      if (options.enableModules) {
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

      return {
        source: fs.readFileSync(absInput, "utf8"),
        tokens: [],
        cst: { kind: "Program", body: [] },
        core: { kind: "Program", body: [] },
        js,
        lintIssues: [],
        lintFixesApplied: 0,
        lintFixedSource: null,
        outputPath: finalOutput,
      };
    } catch (error) {
      return raise(
        enrichError(error, {
          sourceByFile: new Map([
            [absInput, fs.readFileSync(absInput, "utf8")],
          ]),
          source: fs.existsSync(absInput)
            ? fs.readFileSync(absInput, "utf8")
            : null,
        }),
      );
    }
  }

  const run = createTracer(options.tracePasses);
  const useModules = !!options.enableModules;
  let result;
  let graph = null;

  try {
    if (useModules) {
      graph = run("load-module-graph", () =>
        loadModuleGraph(inputPath, options.modules ?? {}),
      );
      run("resolve", () =>
        resolveNames(graph.merged, {
          ...(options.resolve ?? {}),
          strictModuleImports: options.resolve?.strictModuleImports ?? true,
          moduleImportsByPath: graph.moduleImportsByPath,
        }),
      );
      run("typecheck", () => typecheck(graph.merged, options.typecheck ?? {}));
      const mergedSource = graph.ordered
        .map((unit) => unit.source)
        .join("\n\n");
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
      });
      for (const issue of lintIssues) {
        enrichError(issue, { sourceByFile });
      }
      const lintMode = options.lint?.mode ?? "error";
      if (lintIssues.length > 0 && lintMode !== "warn") {
        return raise(lintIssues[0]);
      }
      const js = run("codegen", () => generateJavaScript(graph.merged));
      result = {
        source: fs.readFileSync(inputPath, "utf8"),
        tokens: graph.ordered.at(-1)?.tokens ?? [],
        cst: graph.ordered.at(-1)?.cst ?? { kind: "Program", body: [] },
        core: graph.merged,
        js,
        lintIssues,
        lintFixesApplied,
        lintFixedSource,
        moduleGraph: graph,
      };
    } else {
      const source = fs.readFileSync(inputPath, "utf8");
      result = compileSource(source, inputPath, options);
    }
  } catch (error) {
    const sourceByFile = new Map();
    if (useModules && graph?.ordered) {
      for (const unit of graph.ordered) {
        sourceByFile.set(unit.filePath, unit.source);
      }
    }
    if (!useModules && fs.existsSync(inputPath)) {
      sourceByFile.set(
        path.resolve(inputPath),
        fs.readFileSync(inputPath, "utf8"),
      );
    }
    return raise(
      enrichError(error, {
        sourceByFile,
        source: fs.existsSync(inputPath)
          ? fs.readFileSync(inputPath, "utf8")
          : null,
      }),
    );
  }

  const finalOutput = outputPath ?? inputPath.replace(/\.tuff$/i, ".js");
  fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
  fs.writeFileSync(finalOutput, result.js, "utf8");
  return { ...result, outputPath: finalOutput };
}

export function compileSourceResult(
  source,
  filePath = "<memory>",
  options = {},
) {
  try {
    return ok(compileSource(source, filePath, options));
  } catch (error) {
    return err(error);
  }
}

export function compileFileResult(inputPath, outputPath = null, options = {}) {
  try {
    return ok(compileFile(inputPath, outputPath, options));
  } catch (error) {
    return err(error);
  }
}
