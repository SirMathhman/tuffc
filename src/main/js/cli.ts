#!/usr/bin/env node
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileFileResult } from "./compiler.ts";
import { formatDiagnostic, toDiagnostic } from "./errors.ts";

function printUsage(): void {
  console.log(
    "Usage:\n  tuff compile <input.tuff> [-o output.js|output.c] [--target <js|c>] [--stage2] [--modules] [--module-base <dir>] [--selfhost|--stage0] [--lint] [--lint-fix] [--lint-strict] [--json-errors] [--trace-passes]",
  );
}

function printLintIssues(issues: unknown[]): void {
  if (!issues || issues.length === 0) return;
  console.warn(`Lint issues (${issues.length}):`);
  for (let idx = 0; idx < issues.length; idx += 1) {
    const diag = toDiagnostic(issues[idx]);
    console.warn(`\n[${idx + 1}/${issues.length}] ${formatDiagnostic(diag)}`);
  }
}

function main(argv: string[]): void {
  const args = argv.slice(2);
  const command = args[0];
  if (!command || command === "-h" || command === "--help") {
    printUsage();
    return;
  }

  if (command !== "compile") {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const input = args[1];
  if (!input) {
    console.error("Missing input file");
    printUsage();
    process.exitCode = 1;
    return;
  }

  let output = undefined;
  let stage2 = false;
  let modules = false;
  let moduleBaseDir = undefined;
  let jsonErrors = false;
  let requestedBackend = undefined;
  let lint = false;
  let lintFix = false;
  let lintStrict = false;
  let tracePasses = false;
  let target = "js";
  const unknownFlags = [];
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--out") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --out/-o");
        process.exitCode = 1;
        return;
      }
      output = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (args[i] === "--stage2") {
      stage2 = true;
      continue;
    }
    if (args[i] === "--modules") {
      modules = true;
      continue;
    }
    if (args[i] === "--module-base") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --module-base");
        process.exitCode = 1;
        return;
      }
      moduleBaseDir = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (args[i] === "--json-errors") {
      jsonErrors = true;
      continue;
    }
    if (args[i] === "--selfhost") {
      requestedBackend = "selfhost";
      continue;
    }
    if (args[i] === "--stage0") {
      requestedBackend = "stage0";
      continue;
    }
    if (args[i] === "--lint") {
      lint = true;
      continue;
    }
    if (args[i] === "--lint-fix") {
      lint = true;
      lintFix = true;
      continue;
    }
    if (args[i] === "--lint-strict") {
      lint = true;
      lintStrict = true;
      continue;
    }
    if (args[i] === "--trace-passes") {
      tracePasses = true;
      continue;
    }
    if (args[i] === "--target") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --target");
        process.exitCode = 1;
        return;
      }
      target = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i].startsWith("-")) {
      unknownFlags.push(args[i]);
    }
  }

  if (unknownFlags.length > 0) {
    console.error(`Unknown option(s): ${unknownFlags.join(", ")}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const selfhostRequested = args.includes("--selfhost");
  const stage0Requested = args.includes("--stage0");
  if (selfhostRequested && stage0Requested) {
    console.error("Options --selfhost and --stage0 are mutually exclusive");
    printUsage();
    process.exitCode = 1;
    return;
  }

  const backend =
    requestedBackend ?? (lint || tracePasses ? "stage0" : "selfhost");

  const result = compileFileResult(path.resolve(input), output, {
    backend,
    enableModules: modules,
    modules: {
      moduleBaseDir: moduleBaseDir ?? path.dirname(path.resolve(input)),
    },
    typecheck: { strictSafety: stage2 },
    lint: {
      enabled: lint,
      fix: lintFix,
      mode: lintStrict ? "error" : "warn",
    },
    target,
    tracePasses,
  });

  if (!result.ok) {
    const diag = toDiagnostic(result.error);
    if (jsonErrors) {
      console.error(JSON.stringify(diag, undefined, 2));
    } else {
      console.error(formatDiagnostic(diag));
    }
    process.exitCode = 1;
    return;
  }

  const {
    outputPath,
    lintIssues = [],
    lintFixesApplied = 0,
    lintFixedSource = undefined,
  } = result.value;

  if (lintFix && !modules && typeof lintFixedSource === "string") {
    const absInput = path.resolve(input);
    fs.writeFileSync(absInput, lintFixedSource, "utf8");
    console.log(`Applied ${lintFixesApplied} lint auto-fix(es) to ${input}`);
  }

  console.log(`Compiled ${input} -> ${outputPath}`);
  if (lint) {
    printLintIssues(lintIssues);
    if (lintStrict && lintIssues.length > 0) {
      process.exitCode = 1;
    }
  }
}

main(process.argv);
