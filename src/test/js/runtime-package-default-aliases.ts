// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileFileResult } from "../../main/js/compiler.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";

function assertDefaultAliasCompile(result, label) {
  if (!result.ok) {
    console.error(
      `Expected ${label} compile with default runtime aliases, got: ${result.error.message}`,
    );
    process.exit(1);
  }
}

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = path.join(
  root,
  "tests",
  "out",
  "runtime-package-default-aliases",
);
const appDir = path.join(outDir, "app");
const entry = path.join(appDir, "Main.tuff");

fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(
  entry,
  [
    "let { length } = tuff_core::Strings;",
    "let { vec_new_i32, vec_push_i32, vec_length_i32 } = tuff_core::Collections;",
    "fn main() : I32 => if (",
    '  "abc".length() == 3USize &&',
    "  vec_length_i32(vec_push_i32(vec_new_i32(), 7)) == 1USize",
    ") 42 else 0;",
    "",
  ].join("\n"),
  "utf8",
);

const jsOut = path.join(outDir, "main.js");
const cOut = path.join(outDir, "main.c");

const jsResult = compileFileResult(entry, jsOut, {
  backend: "selfhost",
  target: "js",
  modules: {
    moduleBaseDir: appDir,
  },
});

assertDefaultAliasCompile(jsResult, "JS");

if (
  typeof jsResult.value.js !== "string" ||
  !jsResult.value.js.includes("function main(")
) {
  console.error(
    "Expected JavaScript output for default runtime alias JS compile",
  );
  process.exit(1);
}

const cResult = compileFileResult(entry, cOut, {
  backend: "selfhost",
  target: "c",
  modules: {
    moduleBaseDir: appDir,
  },
});

assertDefaultAliasCompile(cResult, "C");

if (
  typeof cResult.value.c !== "string" ||
  !cResult.value.c.includes("int main(void)")
) {
  console.error("Expected C output for default runtime alias C compile");
  process.exit(1);
}

console.log("Default runtime package alias checks passed");
