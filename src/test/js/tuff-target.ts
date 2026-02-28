// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compileSourceResult,
  compileFileResult,
} from "../../main/js/compiler.ts";
import { getCLIPaths } from "./path-test-utils.ts";
import { assertCompileOk } from "./compile-test-utils.ts";

const { root, tsxCli, nodeExec } = getCLIPaths(import.meta.url);
const outDir = path.join(root, "tests", "out", "tuff-target");
fs.mkdirSync(outDir, { recursive: true });

const source = [
  "// file header comment",
  "extern fn str_length(this: *Str) : I32;",
  "/* keep this block comment */",
  "fn main() : I32 => {",
  "  // trailing behavior check",
  '  str_length("abc")',
  "}",
  "",
].join("\n");

const inMemory = compileSourceResult(source, "<tuff-target-memory>", {
  backend: "selfhost",
  target: "tuff",
  lint: { enabled: true, fix: true, mode: "warn" },
});

assertCompileOk(inMemory, "in-memory tuff target");

const tuffOut = (inMemory.value as { tuff?: string }).tuff ?? "";
if (!tuffOut.includes("// file header comment")) {
  console.error("Expected tuff target output to preserve file header comment");
  process.exit(1);
}
if (!tuffOut.includes("/* keep this block comment */")) {
  console.error("Expected tuff target output to preserve block comment");
  process.exit(1);
}
if (!tuffOut.endsWith("\n")) {
  console.error("Expected tuff target output to end with trailing newline");
  process.exit(1);
}

const lintFixedSource =
  (inMemory.value as { lintFixedSource?: string }).lintFixedSource ?? "";
if (!lintFixedSource.includes('"abc".str_length()')) {
  console.error(
    "Expected deterministic lint-fix to rewrite receiver-style call",
  );
  process.exit(1);
}

const inputPath = path.join(outDir, "target-input.tuff");
const outputPath = path.join(outDir, "target-output.tuff");
fs.writeFileSync(inputPath, source, "utf8");

const fileResult = compileFileResult(inputPath, outputPath, {
  backend: "selfhost",
  target: "tuff",
  lint: { enabled: true, fix: true, mode: "warn" },
});
assertCompileOk(fileResult, "file tuff target");
if (!fs.existsSync(outputPath)) {
  console.error("Expected tuff target output file to be created");
  process.exit(1);
}

const cliOutPath = path.join(outDir, "target-cli-output.tuff");
const cliRun = spawnSync(
  nodeExec,
  [
    tsxCli,
    "./src/main/js/cli.ts",
    inputPath,
    "--target",
    "tuff",
    "--lint",
    "--lint-fix",
    "-o",
    cliOutPath,
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);
if (cliRun.status !== 0) {
  console.error("Expected CLI tuff target + lint-fix success");
  console.error(`${cliRun.stdout ?? ""}\n${cliRun.stderr ?? ""}`);
  process.exit(1);
}

const updatedInput = fs.readFileSync(inputPath, "utf8");
if (!updatedInput.includes('"abc".str_length()')) {
  console.error("Expected CLI --lint-fix to rewrite input source");
  process.exit(1);
}

console.log("Tuff target checks passed");
