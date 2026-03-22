import { spawnSync } from "node:child_process";

function runStep(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (typeof result.status !== "number" || result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runStep("bun", ["test", "tests/compiler.compile.test.ts"]);
runStep("bun", ["test", "tests/compiler.execute.test.ts"]);
runStep("bun", ["test", "tests/placeholder.test.ts"]);
runStep("node", [
  "./node_modules/eslint/bin/eslint.js",
  "--no-error-on-unmatched-pattern",
  "src/**/*.ts",
  "tests/**/*.ts",
]);

if (process.platform === "win32") {
  runStep("cmd", [
    "/c",
    "pmd",
    "cpd",
    "--dir",
    "src,tests",
    "--language",
    "typescript",
    "--minimum-tokens",
    "35",
    "--ignore-identifiers",
    "--ignore-literals",
  ]);
} else {
  runStep("pmd", [
    "cpd",
    "--dir",
    "src,tests",
    "--language",
    "typescript",
    "--minimum-tokens",
    "35",
    "--ignore-identifiers",
    "--ignore-literals",
  ]);
}
