// @ts-nocheck
import path from "node:path";
import { compileFileResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "demo-regressions");

const compileFailureCases = [
  {
    file: "demo-array-bounds-fixed.tuff",
    expectedMessagePart: "Unexpected token",
  },
  {
    file: "demo-div-by-zero.tuff",
    expectedMessagePart: "Division by zero",
  },
  {
    file: "demo-nullable-pointer.tuff",
    expectedMessagePart: "Unexpected token",
  },
];

const compileSuccessCases = [
  {
    file: "demo-array-bounds.tuff",
  },
  {
    file: "demo-c-interop.tuff",
  },
  {
    file: "demo-div-by-zero-safe.tuff",
    expectedMainResult: 5,
  },
  {
    file: "demo-overflow.tuff",
  },
  {
    file: "demo-overflow-call.tuff",
  },
];

function compileDemo(fileName: string) {
  const inputPath = path.join(root, "tests", fileName);
  const outputPath = path.join(outDir, fileName.replace(/\.tuff$/, ".js"));
  return compileFileResult(inputPath, outputPath, {
    backend: "stage0",
    typecheck: { strictSafety: true },
  });
}

for (const testCase of compileFailureCases) {
  const result = compileDemo(testCase.file);
  if (result.ok) {
    console.error(
      `Expected ${testCase.file} to fail compile under strict safety, but it compiled`,
    );
    process.exit(1);
  }

  const message = String(result.error?.message ?? "");
  if (!message.includes(testCase.expectedMessagePart)) {
    console.error(
      `Expected ${testCase.file} failure to include '${testCase.expectedMessagePart}', got: ${message}`,
    );
    process.exit(1);
  }
}

for (const testCase of compileSuccessCases) {
  const result = compileDemo(testCase.file);
  if (!result.ok) {
    console.error(
      `Expected ${testCase.file} to compile under strict safety, but failed: ${result.error?.message ?? "<unknown>"}`,
    );
    process.exit(1);
  }

  if (typeof testCase.expectedMainResult !== "undefined") {
    const got = runMainFromJs(
      result.value.js,
      `demo-regression:${testCase.file}`,
    );
    if (got !== testCase.expectedMainResult) {
      console.error(
        `Expected main() for ${testCase.file} to return ${testCase.expectedMainResult}, got ${got}`,
      );
      process.exit(1);
    }
  }
}

console.log(
  `Demo regression checks passed (${compileFailureCases.length} compile-fail, ${compileSuccessCases.length} compile-pass)`,
);
