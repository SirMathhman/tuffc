import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { desugar } from "./desugar.js";
import { resolveNames } from "./resolve.js";
import { typecheck } from "./typecheck.js";
import { lintProgram } from "./linter.js";
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
  return program.body
    .filter((n) => n.kind === "ImportDecl")
    .map((n) => n.modulePath);
}

function modulePathToFile(modulePath, moduleBaseDir) {
  return path.join(moduleBaseDir, ...modulePath.split("::")) + ".tuff";
}

function loadModuleGraph(entryPath, options = {}) {
  const moduleBaseDir = options.moduleBaseDir ?? path.dirname(entryPath);
  const seen = new Set();
  const visiting = new Set();
  const ordered = [];

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

    for (const imp of gatherImports(core)) {
      visit(modulePathToFile(imp, moduleBaseDir), [...trail, abs]);
    }

    visiting.delete(abs);
    seen.add(abs);
    ordered.push({ filePath: abs, source, tokens, cst, core });
  };

  visit(entryPath);

  const merged = {
    kind: "Program",
    body: ordered.flatMap((unit) =>
      unit.core.body.filter((n) => n.kind !== "ImportDecl"),
    ),
  };

  return { ordered, merged };
}

export function compileSource(source, filePath = "<memory>", options = {}) {
  const run = createTracer(options.tracePasses);
  try {
    const tokens = run("lex", () => lex(source, filePath));
    const cst = run("parse", () => parse(tokens));
    const core = run("desugar", () => desugar(cst));
    run("resolve", () => resolveNames(core, options.resolve ?? {}));
    run("typecheck", () => typecheck(core, options.typecheck ?? {}));
    const lintIssues = lintProgram(core, options.lint ?? {});
    if (lintIssues.length > 0) {
      throw lintIssues[0];
    }
    const js = run("codegen", () => generateJavaScript(core));
    return { tokens, cst, core, js };
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
      run("resolve", () => resolveNames(graph.merged, options.resolve ?? {}));
      run("typecheck", () => typecheck(graph.merged, options.typecheck ?? {}));
      const lintIssues = lintProgram(graph.merged, options.lint ?? {});
      if (lintIssues.length > 0) {
        throw lintIssues[0];
      }
      const js = run("codegen", () => generateJavaScript(graph.merged));
      result = {
        source: fs.readFileSync(inputPath, "utf8"),
        tokens: graph.ordered.at(-1)?.tokens ?? [],
        cst: graph.ordered.at(-1)?.cst ?? { kind: "Program", body: [] },
        core: graph.merged,
        js,
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
