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
    `[tuff-lint] Missing native compiler executable: ${exePath}\n` +
      "Run `npm run native:selfhost:parity` first.",
  );
  process.exit(1);
}

const env = { ...process.env };
if (fs.existsSync(substratePath)) env.TUFFC_SUBSTRATE_PATH = substratePath;
if (fs.existsSync(preludePath)) env.TUFFC_PRELUDE_PATH = preludePath;

const TIMEOUT_MS = 120_000; // 2 minutes

function formatStructuredLintOutput(raw) {
  if (typeof raw !== "string" || raw.length === 0) return "";
  if (!raw.includes("\u001f")) return raw;

  let issueIndex = 0;
  const formatted = raw
    .replace(
      /([^\u001e\u001f]+)\u001f([^\u001e\u001f]*)\u001f([^\u001e\u001f]*)\u001f([^\u001e\u001f]*)\u001f([^\u001e\u001f]*)\u001f([^\u001e\u001f]*)/g,
      (_match, code, message, reason, fix, sourceMapStr, colStr) => {
        issueIndex += 1;
        // sourceMapStr format: "path:Lline" (e.g., "src/main/tuff/selfhost/linter.tuff:L1396")
        const sourceMapMatch = sourceMapStr
          ? sourceMapStr.match(/^(.+):L(\d+)$/)
          : null;
        const filePath = sourceMapMatch
          ? sourceMapMatch[1]
          : sourceMapStr || "<unknown>";
        const line = sourceMapMatch ? parseInt(sourceMapMatch[2], 10) : 0;
        const col = colStr ? parseInt(colStr, 10) : 0;
        const location =
          line > 0 && col > 0
            ? ` (${filePath}:${line}:${col})`
            : filePath !== "<unknown>"
              ? ` (${filePath})`
              : "";
        const lines = [
          `\n[${issueIndex}] ${String(code).trim()}: ${String(message).trim()}${location}`,
        ];
        const reasonText = String(reason).trim();
        const fixText = String(fix).trim();
        if (reasonText) lines.push(`  Reason: ${reasonText}`);
        if (fixText) lines.push(`  Fix: ${fixText}`);
        return `${lines.join("\n")}\n`;
      },
    )
    .replaceAll("\u001e", "\n");

  if (issueIndex === 0) {
    return raw.replaceAll("\u001e", "\n").replaceAll("\u001f", "\n  ");
  }
  return formatted;
}

// Prepend "lint" subcommand before user args
const args = ["lint", ...process.argv.slice(2)];
const run = spawnSync(exePath, args, {
  cwd: root,
  stdio: ["inherit", "pipe", "pipe"],
  env,
  timeout: TIMEOUT_MS,
  encoding: "utf8",
});

const stdoutText = formatStructuredLintOutput(run.stdout ?? "");
const stderrText = formatStructuredLintOutput(run.stderr ?? "");

if (stdoutText.length > 0) {
  process.stdout.write(
    stdoutText.endsWith("\n") ? stdoutText : `${stdoutText}\n`,
  );
}
if (stderrText.length > 0) {
  process.stderr.write(
    stderrText.endsWith("\n") ? stderrText : `${stderrText}\n`,
  );
}

if (run.error) {
  if (run.error.code === "ETIMEDOUT") {
    console.error(
      `[tuff-lint] TIMEOUT: process exceeded ${TIMEOUT_MS / 1000}s — killed`,
    );
    process.exit(124);
  }
  console.error(`[tuff-lint] ERROR: ${run.error.message}`);
  process.exit(1);
}

process.exit(run.status ?? 1);
