// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFileResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "runtime-package-default-aliases");
const appDir = path.join(outDir, "app");
const entry = path.join(appDir, "Main.tuff");

fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(
  entry,
  [
    "let { length } = tuff_core::stdlib;",
    'fn main() : I32 => if ("abc".length() == 3USize) 42 else 0;',
    "",
  ].join("\n"),
  "utf8",
);

const jsOut = path.join(outDir, "main.js");
const cOut = path.join(outDir, "main.c");

const jsResult = compileFileResult(entry, jsOut, {
  backend: "stage0",
  target: "js",
  enableModules: true,
  modules: {
    moduleBaseDir: appDir,
  },
});

if (!jsResult.ok) {
  console.error(`Expected JS compile with default runtime aliases, got: ${jsResult.error.message}`);
  process.exit(1);
}

if (typeof jsResult.value.js !== "string" || !jsResult.value.js.includes("function main(")) {
  console.error("Expected JavaScript output for default runtime alias JS compile");
  process.exit(1);
}

const cResult = compileFileResult(entry, cOut, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: {
    moduleBaseDir: appDir,
  },
});

if (!cResult.ok) {
  console.error(`Expected C compile with default runtime aliases, got: ${cResult.error.message}`);
  process.exit(1);
}

if (typeof cResult.value.c !== "string" || !cResult.value.c.includes("int main(void)")) {
  console.error("Expected C output for default runtime alias C compile");
  process.exit(1);
}

console.log("Default runtime package alias checks passed");
