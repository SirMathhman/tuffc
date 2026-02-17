import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { getRepoRootFromImportMeta, getTsxCliPath } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);

function expectFail(args, expectedText, label) {
  const result = spawnSync(
    process.execPath,
    [tsxCli, "./src/main/js/cli.ts", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (result.status === 0) {
    console.error(`${label}: expected non-zero exit status`);
    process.exit(1);
  }

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!combined.includes(expectedText)) {
    console.error(
      `${label}: expected output to include '${expectedText}', got:\n${combined}`,
    );
    process.exit(1);
  }
}

function expectPass(args, label) {
  const result = spawnSync(
    process.execPath,
    [tsxCli, "./src/main/js/cli.ts", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    console.error(`${label}: expected zero exit status, got ${result.status}`);
    console.error(combined);
    process.exit(1);
  }
}

function expectPassContains(args, expectedText, label) {
  const result = spawnSync(
    process.execPath,
    [tsxCli, "./src/main/js/cli.ts", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    console.error(`${label}: expected zero exit status, got ${result.status}`);
    console.error(combined);
    process.exit(1);
  }

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!combined.includes(expectedText)) {
    console.error(
      `${label}: expected output to include '${expectedText}', got:\n${combined}`,
    );
    process.exit(1);
  }
}

expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--nope"],
  "Unknown option(s): --nope",
  "unknown-flag",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--module-base"],
  "Missing value for --module-base",
  "missing-module-base-value",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "-o"],
  "Missing value for --out/-o",
  "missing-out-value",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--target"],
  "Missing value for --target",
  "missing-target-value",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--target", "llvm"],
  "E_UNSUPPORTED_TARGET",
  "unsupported-target",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--native", "--target", "js"],
  "--native is only supported when --target c is selected",
  "native-js-target-rejected",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--native-out"],
  "Missing value for --native-out",
  "missing-native-out-value",
);
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "--cc"],
  "Missing value for --cc",
  "missing-cc-value",
);
expectFail(
  [
    "compile",
    "./src/test/tuff/cases/factorial.tuff",
    "./src/test/tuff/cases/enum_match.tuff",
  ],
  "Expected exactly one input file",
  "deprecated-multi-input-rejected",
);
expectFail(
  ["@./tests/out/cli-hardening/does-not-exist.rsp"],
  "Unable to read response file",
  "missing-response-file",
);
expectFail(["--help=bogus"], "Unknown help topic", "unknown-help-topic");
expectFail(
  ["./src/test/tuff/cases/factorial.tuff", "-Wmystery"],
  "Unknown option(s): -Wmystery",
  "unknown-warning-group",
);

const outDir = path.join(root, "tests", "out", "cli-hardening");
fs.mkdirSync(outDir, { recursive: true });
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-c",
    "-g",
    "-O2",
    "-std=tuff2024",
    "-o",
    path.join(outDir, "compat-flags.js"),
  ],
  "c-compat-flags-pass",
);
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-o",
    path.join(outDir, "warnings-mapped.js"),
  ],
  "warning-flags-mapped",
);
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-Wall",
    "-Werror",
    "-Wno-error",
    "-o",
    path.join(outDir, "warning-no-error.js"),
  ],
  "warning-no-error",
);
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-Wall",
    "-Werror=lint",
    "-Wno-error=lint",
    "-o",
    path.join(outDir, "warning-group-switches.js"),
  ],
  "warning-group-switches",
);
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-Wlint",
    "-Werror=lint",
    "-Wno-lint",
    "-Wno-error=lint",
    "-o",
    path.join(outDir, "warning-group-toggle-cycle.js"),
  ],
  "warning-group-toggle-cycle",
);
expectPass(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "--color=never",
    "-fdiagnostics-color=auto",
    "-o",
    path.join(outDir, "diagnostics-color-flags.js"),
  ],
  "diagnostics-color-flags",
);
expectPassContains(
  [
    "./src/test/tuff/cases/factorial.tuff",
    "--target",
    "c",
    "--native",
    "-o",
    path.join(outDir, "native-factorial.c"),
    "--native-out",
    path.join(outDir, process.platform === "win32" ? "native-factorial.exe" : "native-factorial"),
  ],
  "Native build succeeded:",
  "native-c-build-success",
);
expectPassContains(
  ["--help=warnings"],
  "Warning options:",
  "help-topic-warnings",
);
expectPassContains(
  ["--help=diagnostics"],
  "Diagnostics options:",
  "help-topic-diagnostics",
);
expectPassContains(
  ["--help=optimizers"],
  "Optimization options:",
  "help-topic-optimizers",
);

const responseFile = path.join(outDir, "compile.rsp");
fs.writeFileSync(
  responseFile,
  [
    "./src/test/tuff/cases/factorial.tuff",
    "-O3",
    "-g",
    '-o "./tests/out/cli-hardening/response output.js"',
  ].join("\n"),
  "utf8",
);
expectPass([`@${responseFile}`], "response-file-compile");

console.log("CLI hardening checks passed");
