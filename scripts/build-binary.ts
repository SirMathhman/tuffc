import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const distDir = path.join(root, "dist");
const outputArg =
  process.argv.find((arg) => arg.startsWith("--out=")) ??
  `--out=${path.join(distDir, process.platform === "win32" ? "tuffc.exe" : "tuffc")}`;
const outputPath = outputArg.slice("--out=".length);
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = String(pkg.version ?? "0.0.0");

const run = spawnSync(
  "bun",
  [
    "build",
    "./src/main/js/cli.ts",
    "--compile",
    "--define",
    `__TUFFC_VERSION__=\"${version}\"`,
    `--outfile=${outputPath}`,
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (run.status !== 0) {
  console.error(
    "Failed to package tuffc executable via Bun. Ensure Bun is installed and available in PATH.",
  );
  process.exit(run.status ?? 1);
}

console.log(`Built executable: ${outputPath}`);
