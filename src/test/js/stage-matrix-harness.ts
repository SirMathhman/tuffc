// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { compileSourceThrow } from "../../main/js/compiler.ts";
import { lex } from "../../main/js/lexer.ts";
import { parse } from "../../main/js/parser.ts";
import { desugar } from "../../main/js/desugar.ts";
import { resolveNames } from "../../main/js/resolve.ts";
import { typecheck } from "../../main/js/typecheck.ts";
import { borrowcheck } from "../../main/js/borrowcheck.ts";
import { generateJavaScript } from "../../main/js/codegen-js.ts";
import * as runtime from "../../main/js/runtime.ts";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";

function loadVmExports(js, exportsList, extraGlobals = {}) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...extraGlobals,
  };
  vm.runInNewContext(
    `${js}\nmodule.exports = { ${exportsList.join(", ")} };`,
    sandbox,
  );
  return sandbox.module.exports;
}

function createStage1HostHooks() {
  return {
    __host_lex: (source) => {
      const result = lex(source, "<stage1-host>");
      if (!result.ok) throw result.error;
      return result.value;
    },
    __host_parse: (tokens) => {
      const result = parse(tokens);
      if (!result.ok) throw result.error;
      return result.value;
    },
    __host_desugar: (cst) => desugar(cst),
    __host_resolveNames: (core) => {
      const result = resolveNames(core, {
        allowHostPrefix: "__host_",
        hostBuiltins: Object.keys(runtime),
      });
      if (!result.ok) throw result.error;
      return result.value;
    },
    __host_typecheck: (core) => {
      const result = typecheck(core);
      if (!result.ok) throw result.error;
      return result.value;
    },
    __host_borrowcheck: (core) => {
      const result = borrowcheck(core);
      if (!result.ok) throw result.error;
      return result.value;
    },
    __host_generateJavaScript: (core) => generateJavaScript(core),
    __host_readFile: (filePath) => fs.readFileSync(filePath, "utf8"),
    __host_writeFile: (filePath, contents) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents, "utf8");
      return 0;
    },
  };
}

function loadStageCompilerFromJs(js) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };
  vm.runInNewContext(
    `${js}
const __exports = {};
if (typeof compile_source !== "undefined") __exports.compile_source = compile_source;
if (typeof compile_file !== "undefined") __exports.compile_file = compile_file;
if (typeof compile_source_with_options !== "undefined") __exports.compile_source_with_options = compile_source_with_options;
if (typeof compile_file_with_options !== "undefined") __exports.compile_file_with_options = compile_file_with_options;
if (typeof take_lint_issues !== "undefined") __exports.take_lint_issues = take_lint_issues;
if (typeof main !== "undefined") __exports.main = main;
module.exports = __exports;`,
    sandbox,
  );
  return sandbox.module.exports;
}

export function buildStageChain(root, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const stage1Path = path.join(root, "src", "main", "tuff", "compiler.tuff");
  const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");

  const stage1Source = fs.readFileSync(stage1Path, "utf8");
  const selfhostSource = fs.readFileSync(selfhostPath, "utf8");

  const stage1AJs = compileSourceThrow(stage1Source, stage1Path, {
    backend: "stage0",
    resolve: { allowHostPrefix: "__host_" },
  }).js;
  fs.writeFileSync(path.join(outDir, "stage1_a.js"), stage1AJs, "utf8");

  const stage1 = loadVmExports(
    stage1AJs,
    ["compileToJs", "compileToArtifacts", "compileFileToJs", "main"],
    createStage1HostHooks(),
  );

  const { selfhostJs: stage2Js, selfhost: stage2 } = compileAndLoadSelfhost(
    root,
    path.join(outDir, "stage2"),
  );
  const stage2Path = path.join(outDir, "stage2.js");
  fs.writeFileSync(stage2Path, stage2Js, "utf8");

  const stage3Path = path.join(outDir, "stage3.js");
  if (typeof stage2.compile_file_with_options === "function") {
    stage2.compile_file_with_options(
      selfhostPath,
      stage3Path,
      0,
      0,
      500,
      1,
      "js",
    );
  } else if (typeof stage2.compile_file === "function") {
    stage2.compile_file(selfhostPath, stage3Path);
  } else {
    const stage3JsFromSource =
      typeof stage2.compile_source_with_options === "function"
        ? stage2.compile_source_with_options(selfhostSource, 0, 0, 500, 1, "js")
        : stage2.compile_source(selfhostSource);
    fs.writeFileSync(stage3Path, stage3JsFromSource, "utf8");
  }

  const stage3Js = fs.readFileSync(stage3Path, "utf8");
  const stage3 = loadStageCompilerFromJs(stage3Js);

  return {
    stage1,
    stage2,
    stage3,
    stage1Path,
    selfhostPath,
    stage2Path,
    stage3Path,
  };
}
