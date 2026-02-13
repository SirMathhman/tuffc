import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { desugar } from "./desugar.js";
import { resolveNames } from "./resolve.js";
import { typecheck } from "./typecheck.js";
import { generateJavaScript } from "./codegen-js.js";

export function compileSource(source, filePath = "<memory>") {
  const tokens = lex(source, filePath);
  const cst = parse(tokens);
  const core = desugar(cst);
  resolveNames(core);
  typecheck(core);
  const js = generateJavaScript(core);
  return { tokens, cst, core, js };
}

export function compileFile(inputPath, outputPath = null) {
  const source = fs.readFileSync(inputPath, "utf8");
  const result = compileSource(source, inputPath);
  const finalOutput = outputPath ?? inputPath.replace(/\.tuff$/i, ".js");
  fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
  fs.writeFileSync(finalOutput, result.js, "utf8");
  return { ...result, outputPath: finalOutput };
}
