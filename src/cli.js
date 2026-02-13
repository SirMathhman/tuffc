#!/usr/bin/env node
import path from "node:path";
import { compileFile } from "./compiler.js";

function printUsage() {
  console.log("Usage:\n  tuff compile <input.tuff> [-o output.js]");
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
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--out") {
      output = args[i + 1] ? path.resolve(args[i + 1]) : null;
      i += 1;
    }
  }

  const { outputPath } = compileFile(path.resolve(input), output);
  console.log(`Compiled ${input} -> ${outputPath}`);
}

main(process.argv);
