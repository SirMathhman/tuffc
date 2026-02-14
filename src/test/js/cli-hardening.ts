import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

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

expectFail(
  ["compile", "./src/test/tuff/cases/factorial.tuff", "--nope"],
  "Unknown option(s): --nope",
  "unknown-flag",
);
expectFail(
  ["compile", "./src/test/tuff/cases/factorial.tuff", "--module-base"],
  "Missing value for --module-base",
  "missing-module-base-value",
);
expectFail(
  ["compile", "./src/test/tuff/cases/factorial.tuff", "-o"],
  "Missing value for --out/-o",
  "missing-out-value",
);

console.log("CLI hardening checks passed");
