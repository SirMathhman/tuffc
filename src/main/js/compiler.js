import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { desugar } from "./desugar.js";
import { resolveNames } from "./resolve.js";
import { typecheck } from "./typecheck.js";
import { autoFixProgram, lintProgram } from "./linter.js";
import { generateJavaScript } from "./codegen-js.js";
import { TuffError, enrichError } from "./errors.js";

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
      throw new TuffError(
        `Module import cycle detected: ${cycle.join(" -> ")}`,
        null,
        {
          code: "E_MODULE_CYCLE",
          reason:
            "The module dependency graph contains a cycle, so a topological compilation order cannot be established.",
          fix: "Break the cycle by moving shared declarations into a third module and import that module from each side.",
        },
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
          throw new TuffError(
            `Cannot import '${importedName}' from ${imp.modulePath}: symbol is not exported with 'out'`,
            imp.loc ?? null,
            {
              code: "E_MODULE_PRIVATE_IMPORT",
              reason:
                "A module import referenced a declaration that exists but is not visible outside its module.",
              fix: `Mark '${importedName}' as 'out' in ${imp.modulePath}, or stop importing it from this module.`,
            },
          );
        }
        throw new TuffError(
          `Cannot import '${importedName}' from ${imp.modulePath}: exported symbol not found`,
          imp.loc ?? null,
          {
            code: "E_MODULE_UNKNOWN_EXPORT",
            reason:
              "A module import requested a symbol that is not exported by the target module.",
            fix: `Check the import list and module exports in ${imp.modulePath}.`,
          },
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
      throw lintIssues[0];
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
    throw enrichError(error, { source });
  }
}

export function compileFile(inputPath, outputPath = null, options = {}) {
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
        throw lintIssues[0];
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
    throw enrichError(error, {
      sourceByFile,
      source: fs.existsSync(inputPath)
        ? fs.readFileSync(inputPath, "utf8")
        : null,
    });
  }

  const finalOutput = outputPath ?? inputPath.replace(/\.tuff$/i, ".js");
  fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
  fs.writeFileSync(finalOutput, result.js, "utf8");
  return { ...result, outputPath: finalOutput };
}
