import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileSource } from "../../main/js/compiler.ts";
import { lex } from "../../main/js/lexer.ts";
import { parse } from "../../main/js/parser.ts";
import { desugar } from "../../main/js/desugar.ts";
import { resolveNames } from "../../main/js/resolve.ts";
import { typecheck } from "../../main/js/typecheck.ts";
import { generateJavaScript } from "../../main/js/codegen-js.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const stage1SourcePath = path.join(
  root,
  "src",
  "main",
  "tuff",
  "compiler.tuff",
);
const stage1OutDir = path.join(root, "tests", "out", "stage1");
const stage1APath = path.join(stage1OutDir, "stage1_a.js");
const stage1BPath = path.join(stage1OutDir, "stage1_b.js");

fs.mkdirSync(stage1OutDir, { recursive: true });

const normalizeJs = (input) =>
  input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();

const stage1Source = fs.readFileSync(stage1SourcePath, "utf8");

// stage0(stage1.tuff) => stage1_a.js
const stage0Result = compileSource(stage1Source, stage1SourcePath, {
  resolve: { allowHostPrefix: "__host_" },
});
fs.writeFileSync(stage1APath, stage0Result.js, "utf8");

const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  __host_lex: (source) => lex(source, "<stage1-host>"),
  __host_parse: (tokens) => parse(tokens),
  __host_desugar: (cst) => desugar(cst),
  __host_resolveNames: (core) =>
    resolveNames(core, { allowHostPrefix: "__host_" }),
  __host_typecheck: (core) => typecheck(core),
  __host_generateJavaScript: (core) => generateJavaScript(core),
  __host_readFile: (filePath) => fs.readFileSync(filePath, "utf8"),
  __host_writeFile: (filePath, contents) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    return 0;
  },
};

vm.runInNewContext(
  `${stage0Result.js}\nmodule.exports = { compileToJs, compileToArtifacts, compileFileToJs, main };`,
  sandbox,
);

const stage1Compiler = sandbox.module.exports;
if (typeof stage1Compiler.compileToJs !== "function") {
  console.error("Stage 1 bootstrap failed: compileToJs not exported");
  process.exit(1);
}

// stage1_a(stage1.tuff) => stage1_b.js
const stage1B = stage1Compiler.compileToJs(stage1Source);
fs.writeFileSync(stage1BPath, stage1B, "utf8");

if (normalizeJs(stage0Result.js) !== normalizeJs(stage1B)) {
  console.error(
    "Bootstrap equivalence failed: stage1_a.js and stage1_b.js differ",
  );
  process.exit(1);
}

// smoke-check a non-stage1 program compile equivalence
const smokePath = path.join(
  root,
  "src",
  "test",
  "tuff",
  "cases",
  "factorial.tuff",
);
const smokeSource = fs.readFileSync(smokePath, "utf8");
const smokeA = compileSource(smokeSource, smokePath).js;
const smokeB = stage1Compiler.compileToJs(smokeSource);
if (normalizeJs(smokeA) !== normalizeJs(smokeB)) {
  console.error("Stage 1 smoke compile equivalence failed for factorial.tuff");
  process.exit(1);
}

console.log("Stage 1 bootstrap equivalence passed");
