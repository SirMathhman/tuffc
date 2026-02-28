// @ts-nocheck
import path from "node:path";
import { compileFileResult } from "../../main/js/compiler.ts";
import { getCLIPaths } from "./path-test-utils.ts";

const { root } = getCLIPaths(import.meta.url);
const input = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const moduleBaseDir = path.join(root, "src", "main", "tuff");

const result = compileFileResult(input, undefined, {
  backend: "selfhost",
  modules: { moduleBaseDir },
  lint: { enabled: true, mode: "warn", maxEffectiveLines: 100 },
});

if (!result.ok) {
  const error = result.error as { code?: string };
  console.error(
    `Expected compile success while collecting lint issues, got: ${String(error?.code ?? "unknown")}`,
  );
  process.exit(1);
}

const issues = result.value.lintIssues ?? [];
const tooLong = issues.filter(
  (issue) => issue.code === "E_LINT_FUNCTION_TOO_LONG",
);

if (tooLong.length !== 0) {
  console.error(
    `Expected 0 E_LINT_FUNCTION_TOO_LONG issues at threshold 100, got ${tooLong.length}`,
  );
  for (const issue of tooLong) {
    console.error(issue.message);
  }
  process.exit(1);
}

console.log("Selfhost function-length budget check passed");
