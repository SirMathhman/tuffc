#!/usr/bin/env node
import path from "node:path";
import { compileFile } from "./compiler.js";
import { formatDiagnostic, toDiagnostic } from "./errors.js";

function printUsage() {
  console.log(
    "Usage:\n  tuff compile <input.tuff> [-o output.js] [--stage2] [--modules] [--module-base <dir>] [--lint] [--json-errors] [--trace-passes]",
  );
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
    const { outputPath } = compileFile(path.resolve(input), output, {
      enableModules: modules,
      modules: {
        moduleBaseDir: moduleBaseDir ?? path.dirname(path.resolve(input)),
      },
      typecheck: { strictSafety: stage2 },
      lint: { enabled: lint },
      tracePasses,
    });
    console.log(`Compiled ${input} -> ${outputPath}`);
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
