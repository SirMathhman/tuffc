#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const outDir = path.join(root, "tests", "out", "c-bootstrap");

const exePath = path.join(
  outDir,
  process.platform === "win32"
    ? "stage3_selfhost_cli.exe"
    : "stage3_selfhost_cli",
);
const substratePath = path.join(outDir, "embedded_c_substrate.c");
const preludePath = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "RuntimePrelude.tuff",
);

if (!fs.existsSync(exePath)) {
  console.error(
    `[tuffc-native] Missing native compiler executable: ${exePath}\n` +
      "Run `npm run native:selfhost:parity` first.",
  );
  process.exit(1);
}

const env = { ...process.env };
if (fs.existsSync(substratePath)) env.TUFFC_SUBSTRATE_PATH = substratePath;
if (fs.existsSync(preludePath)) env.TUFFC_PRELUDE_PATH = preludePath;

const TIMEOUT_MS = 120_000; // 2 minutes

const args = process.argv.slice(2);
const run = spawnSync(exePath, args, {
  cwd: root,
  stdio: "inherit",
  env,
  timeout: TIMEOUT_MS,
});

if (run.error) {
  if (run.error.code === "ETIMEDOUT") {
    console.error(
      `[tuffc-native] TIMEOUT: process exceeded ${TIMEOUT_MS / 1000}s — killed`,
    );
    process.exit(124);
  }
  console.error(`[tuffc-native] ERROR: ${run.error.message}`);
  process.exit(1);
}

process.exit(run.status ?? 1);
