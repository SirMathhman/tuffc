#!/usr/bin/env node
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileFileResult } from "./compiler.ts";
import { loadTuffConfig } from "./config.ts";
import { formatDiagnostic, toDiagnostic } from "./errors.ts";

function printUsage(): void {
  console.log(
    `Usage:
  tuff-lint <input.tuff> [options]

Options:
  --strict                  Treat lint findings as errors (exit non-zero)
  --fix                     Apply lint auto-fixes
  --config <path>           Explicit config file path (default: discover tuff.json)
  --ast-dup                 Enable AST duplication checks
  --no-ast-dup              Disable AST duplication checks
  --max-lines <n>           Maximum effective lines per file (default: from config)
  --target <js|c>           Compilation target (default: js)
  -h, --help                Show this help

Description:
  Runs lint checks on Tuff source files. Configuration is loaded from tuff.json
  in the current directory or parent directories. CLI flags override config values.
`,
  );
}

interface LintOptions {
  input: string;
  strict: boolean;
  fix: boolean;
  configPath?: string;
  astDup?: boolean;
  maxLines?: number;
  target: string;
}

function parseLintArgs(args: string[]): LintOptions | null {
  const options: LintOptions = {
    input: "",
    strict: false,
    fix: false,
    target: "js",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--strict") {
      options.strict = true;
      i += 1;
      continue;
    }

    if (arg === "--fix") {
      options.fix = true;
      i += 1;
      continue;
    }

    if (arg === "--config") {
      if (!args[i + 1]) {
        console.error("Missing value for --config");
        return null;
      }
      options.configPath = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === "--ast-dup") {
      options.astDup = true;
      i += 1;
      continue;
    }

    if (arg === "--no-ast-dup") {
      options.astDup = false;
      i += 1;
      continue;
    }

    if (arg === "--max-lines") {
      if (!args[i + 1]) {
        console.error("Missing value for --max-lines");
        return null;
      }
      const parsed = parseInt(args[i + 1], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error("Invalid value for --max-lines");
        return null;
      }
      options.maxLines = parsed;
      i += 2;
      continue;
    }

    if (arg === "--target") {
      if (!args[i + 1]) {
        console.error("Missing value for --target");
        return null;
      }
      options.target = args[i + 1];
      i += 2;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      return null;
    }

    // First non-flag argument is the input file
    if (!options.input) {
      options.input = arg;
      i += 1;
      continue;
    }

    console.error(`Unexpected argument: ${arg}`);
    return null;
  }

  if (!options.input) {
    console.error("Missing input file");
    printUsage();
    return null;
  }

  return options;
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseLintArgs(args);

  if (!options) {
    process.exitCode = 1;
    return;
  }

  const input = path.resolve(options.input);
  const inputDir = path.dirname(input);

  // Load config
  let config;
  if (options.configPath) {
    const configPath = path.resolve(options.configPath);
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      process.exitCode = 1;
      return;
    }
    try {
      const configText = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(configText);
    } catch (error) {
      console.error(
        `Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }
  } else {
    config = loadTuffConfig(inputDir);
  }

  // Merge CLI overrides with config
  const lintConfig = {
    maxEffectiveLines:
      options.maxLines ?? config.lint?.maxEffectiveLines ?? 500,
    astDupEnabled: options.astDup ?? config.lint?.astDuplicates ?? true,
  };

  // Create a temporary output file (linter doesn't need the compiled output)
  const tempOutput = path.join(
    os.tmpdir(),
    `tuff-lint-${Date.now()}-${Math.random().toString(36).slice(2)}.js`,
  );

  try {
    const result = compileFileResult(input, tempOutput, {
      backend: "selfhost",
      enableModules: true,
      modules: {
        moduleBaseDir: inputDir,
      },
      borrowcheck: {
        enabled: true,
      },
      lint: {
        enabled: true,
        fix: options.fix,
        mode: "error", // Lint is always in error mode (strict)
        maxEffectiveLines: lintConfig.maxEffectiveLines,
        astDupEnabled: lintConfig.astDupEnabled,
      },
      target: options.target,
      tracePasses: false,
    });

    // Clean up temp file if it was created
    try {
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
      }
    } catch {
      // Ignore cleanup errors
    }

    if (!result.ok) {
      const diagnostic = toDiagnostic(result.error);
      console.error(formatDiagnostic(diagnostic));
      process.exitCode = 1;
      return;
    }

    // Check for lint issues
    const lintIssues = result.value.lintIssues || [];

    if (lintIssues.length > 0) {
      for (const issue of lintIssues) {
        console.log(issue);
      }
      console.log(`\nFound ${lintIssues.length} lint issue(s).`);

      if (options.strict) {
        process.exitCode = 1;
      }
    } else {
      console.log("No lint issues found.");
    }

    if (options.fix && result.value.lintFixesApplied > 0) {
      console.log(
        `Applied ${result.value.lintFixesApplied} lint auto-fix(es).`,
      );
    }
  } catch (error) {
    console.error(
      `Lint failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

main();
