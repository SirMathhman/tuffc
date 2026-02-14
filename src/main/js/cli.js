#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { compileFile } from "./compiler.js";
import { formatDiagnostic, toDiagnostic } from "./errors.js";

function printUsage() {
  console.log(
    "Usage:\n  tuff compile <input.tuff> [-o output.js] [--stage2] [--modules] [--module-base <dir>] [--lint] [--lint-fix] [--lint-strict] [--json-errors] [--trace-passes]",
  );
}

function printLintIssues(issues) {
  if (!issues || issues.length === 0) return;
  console.warn(`Lint issues (${issues.length}):`);
  for (let idx = 0; idx < issues.length; idx += 1) {
    const diag = toDiagnostic(issues[idx]);
    console.warn(`\n[${idx + 1}/${issues.length}] ${formatDiagnostic(diag)}`);
  }
}

function main(argv) {
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

  let output = null;
  let stage2 = false;
  let modules = false;
  let moduleBaseDir = null;
  let jsonErrors = false;
  let lint = false;
  let lintFix = false;
  let lintStrict = false;
  let tracePasses = false;
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

  try {
    const {
      outputPath,
      lintIssues = [],
      lintFixesApplied = 0,
      lintFixedSource = null,
    } = compileFile(path.resolve(input), output, {
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
      tracePasses,
    });

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
  } catch (error) {
    const diag = toDiagnostic(error);
    if (jsonErrors) {
      console.error(JSON.stringify(diag, null, 2));
    } else {
      console.error(formatDiagnostic(diag));
    }
    process.exitCode = 1;
  }
}

main(process.argv);
