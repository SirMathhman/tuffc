#!/usr/bin/env node
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  compileFileResult,
  formatTuffSource,
  setCompilerQuietMode,
} from "./compiler.ts";
import { formatDiagnostic, toDiagnostic } from "./errors.ts";
import { buildCertificate } from "./certificate.ts";
import { writeTypstSource, compileTypstToPdf } from "./typst-render.ts";

function printUsage(): void {
  console.log(
    "Usage:\n  tuffc <input.tuff> [options]\n\nOptions:\n  -o, --out <file>          Write output to file\n  --target <js|c|c-split|tuff>\n                            Output target (default: js)\n  --native                  For target c/c-split, compile+link generated C to native executable\n  --native-out <file>       Native executable output path when using --native\n  --cc <compiler>           Native C compiler command (default: auto-detect clang/gcc/cc)\n  -I, --module-base <dir>   Module root directory (legacy compatibility; may be deprecated)\n  --selfhost                Use selfhost backend (default, only backend)\n  --backend <name>          Explicit backend name (default: selfhost)\n  --profile                 Emit per-phase compiler timing JSON\n  -Wall                     Enable common warnings (maps to lint warnings)\n  -Wextra                   Enable extra warnings (maps to lint warnings)\n  -Werror                   Treat warnings as errors (maps to lint strict mode)\n  -Werror=<group>           Treat warning group as errors (e.g. lint, all, extra)\n  -Wno-error                Disable warning-as-error mode\n  -Wno-error=<group>        Disable warning group as errors\n  -Wno-lint, -w             Disable warning/lint compatibility mapping\n  --lint                    Run lint checks\n  --lint-fix                Apply lint auto-fixes\n  --lint-strict             Treat lint findings as errors\n  --no-borrow               Disable borrowcheck (for bootstrap builds)\n  -O0|-O1|-O2|-O3|-Os      Optimization level (accepted; reserved for optimizer)\n  -g                        Emit debug info (accepted; reserved for debug metadata)\n  -c                        Compile only (default behavior; accepted for compatibility)\n  -std=<dialect>            Language dialect (e.g. -std=tuff2024)\n  --color=<auto|always|never>\n                            Diagnostics color policy\n  -fdiagnostics-color[=always|never|auto]\n                            Diagnostics color policy (clang-style)\n  @<file>                   Read additional args from response file\n  --json-errors             Emit diagnostics as JSON\n  --emit-certificate <file> Write a Tuff Verification Certificate (JSON) to file\n  -v, --verbose             Trace compiler passes\n  --trace-passes            Trace compiler passes\n  --version                 Print tuffc version\n  -h, --help                Show help\n  --help=<topic>            Show topic help (warnings|diagnostics|optimizers)\n\nNotes:\n  Module graph loading is always enabled for file compilation.\n\nDeprecated:\n  tuffc compile <input.tuff> [options]",
  );
}

function findNativeCompiler(requested: string | undefined): string | undefined {
  const candidates = requested
    ? [requested]
    : process.platform === "win32"
      ? ["clang", "gcc", "cc"]
      : ["clang", "cc", "gcc"];

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (check.status === 0) return candidate;
  }

  return undefined;
}

function defaultNativeOutputPath(cOutputPath: string): string {
  if (/\.c$/i.test(cOutputPath)) {
    if (process.platform === "win32") {
      return cOutputPath.replace(/\.c$/i, ".exe");
    }
    return cOutputPath.replace(/\.c$/i, "");
  }
  return process.platform === "win32"
    ? `${cOutputPath}.exe`
    : `${cOutputPath}.out`;
}

function compileNativeC(
  cOutputPaths: string[],
  nativeOutputPath: string,
  compiler: string,
): { ok: true } | { ok: false; message: string } {
  const compile = spawnSync(
    compiler,
    [...cOutputPaths, "-O0", "-w", "-o", nativeOutputPath],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  if (compile.status !== 0) {
    return {
      ok: false,
      message:
        `Native C build failed with compiler '${compiler}'.\n` +
        `${compile.stdout ?? ""}\n${compile.stderr ?? ""}`,
    };
  }

  return { ok: true };
}
function splitManifestCFiles(outputDir: string): string[] {
  const manifestPath = path.join(outputDir, "manifest.txt");
  if (!fs.existsSync(manifestPath)) return [];
  const rows = fs
    .readFileSync(manifestPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return rows
    .filter((line) => line.toLowerCase().endsWith(".c"))
    .map((line) => path.join(outputDir, line));
}

function printHelpTopic(topic: string): boolean {
  if (topic === "warnings") {
    console.log(
      "Warning options:\n  -Wall, -Wextra, -Werror, -Werror=<group>, -Wno-error, -Wno-error=<group>, -Wno-lint, -w\n\nGroups:\n  lint, all, extra (aliases for lint compatibility mapping).",
    );
    return true;
  }
  if (topic === "diagnostics") {
    console.log(
      "Diagnostics options:\n  --json-errors\n  --color=<auto|always|never>\n  -fdiagnostics-color\n  -fdiagnostics-color=<auto|always|never>",
    );
    return true;
  }
  if (topic === "optimizers") {
    console.log(
      "Optimization options:\n  -O0, -O1, -O2, -O3, -Os\n\nNote: options are currently accepted for compatibility and reserved for optimizer pipeline rollout.",
    );
    return true;
  }
  return false;
}

function readVersion(): string {
  try {
    if (
      typeof __TUFFC_VERSION__ === "string" &&
      __TUFFC_VERSION__ !== "__TUFFC_VERSION__"
    ) {
      return __TUFFC_VERSION__;
    }
    if (typeof process.env.TUFFC_VERSION === "string") {
      return process.env.TUFFC_VERSION;
    }
    const thisFile = fileURLToPath(import.meta.url);
    const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function printLintIssues(issues: unknown[]): void {
  if (!issues || issues.length === 0) return;
  console.warn(`Lint issues (${issues.length}):`);
  for (let idx = 0; idx < issues.length; idx += 1) {
    const diag = toDiagnostic(issues[idx]);
    console.warn(`\n[${idx + 1}/${issues.length}] ${formatDiagnostic(diag)}`);
  }
}

function shouldUseColor(mode: "auto" | "always" | "never"): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stderr.isTTY);
}

function colorize(text: string, code: number, enabled: boolean): string {
  if (!enabled) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

function tokenizeResponseArgs(content: string): string[] {
  const tokens = [];
  let current = "";
  let quote: string | undefined;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (quote) {
      if (ch === quote) {
        quote = undefined;
        continue;
      }
      if (ch === "\\" && i + 1 < content.length) {
        i += 1;
        current += content[i];
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") {
      while (i < content.length && content[i] !== "\n") i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (quote) {
    throw new Error("Unterminated quote in response file");
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function expandResponseArgs(
  args: string[],
  cwd: string,
  depth = 0,
  trail: Set<string> = new Set(),
): string[] {
  if (depth > 16) {
    throw new Error("Response file nesting is too deep");
  }

  const expanded = [];
  for (const arg of args) {
    if (arg.startsWith("@@")) {
      expanded.push(arg.slice(1));
      continue;
    }
    if (!arg.startsWith("@") || arg.length <= 1) {
      expanded.push(arg);
      continue;
    }

    const responsePath = path.resolve(cwd, arg.slice(1));
    if (trail.has(responsePath)) {
      throw new Error(`Recursive response file detected: ${responsePath}`);
    }

    let content = "";
    try {
      content = fs.readFileSync(responsePath, "utf8");
    } catch {
      throw new Error(`Unable to read response file: ${responsePath}`);
    }

    const nested = tokenizeResponseArgs(content);
    const nextTrail = new Set(trail);
    nextTrail.add(responsePath);
    expanded.push(
      ...expandResponseArgs(
        nested,
        path.dirname(responsePath),
        depth + 1,
        nextTrail,
      ),
    );
  }

  return expanded;
}

function main(argv: string[]): void {
  let rawArgs = argv.slice(2);
  try {
    rawArgs = expandResponseArgs(rawArgs, process.cwd());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
    return;
  }

  if (rawArgs.includes("--version")) {
    console.log(`tuffc ${readVersion()}`);
    return;
  }

  const helpTopicArg = rawArgs.find((arg) => arg.startsWith("--help="));
  if (helpTopicArg) {
    const topic = helpTopicArg.slice("--help=".length).trim().toLowerCase();
    if (!printHelpTopic(topic)) {
      console.error(`Unknown help topic: ${topic}`);
      process.exitCode = 1;
    }
    return;
  }

  if (
    rawArgs.length === 0 ||
    rawArgs.includes("-h") ||
    rawArgs.includes("--help")
  ) {
    printUsage();
    return;
  }

  const args = [...rawArgs];
  if (args[0] === "compile") {
    console.log(
      "Deprecated: 'tuffc compile <input>' is supported for compatibility; prefer 'tuffc <input>'.",
    );
    args.shift();
  }

  if (args[0] === "format") {
    const formatArgs = args.slice(1);
    let write = true;
    let check = false;
    let tracePasses = false;
    const targets: string[] = [];
    const unknown: string[] = [];

    for (let i = 0; i < formatArgs.length; i += 1) {
      const arg = formatArgs[i];
      if (arg === "--write") {
        write = true;
        check = false;
        continue;
      }
      if (arg === "--check") {
        write = false;
        check = true;
        continue;
      }
      if (arg === "--trace-passes" || arg === "-v" || arg === "--verbose") {
        tracePasses = true;
        continue;
      }
      if (arg.startsWith("-")) {
        unknown.push(arg);
        continue;
      }
      targets.push(arg);
    }

    if (unknown.length > 0) {
      console.error(`Unknown format option(s): ${unknown.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    const resolvedTargets =
      targets.length > 0
        ? targets.map((t) => path.resolve(t))
        : [path.resolve("./src/main/tuff")];

    function collectTuffFiles(targetPath: string): string[] {
      if (!fs.existsSync(targetPath)) return [];
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        return targetPath.endsWith(".tuff") ? [targetPath] : [];
      }
      if (!stat.isDirectory()) return [];
      const files: string[] = [];
      for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        const full = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectTuffFiles(full));
          continue;
        }
        if (entry.isFile() && full.endsWith(".tuff")) {
          files.push(full);
        }
      }
      return files;
    }

    const files = [
      ...new Set(resolvedTargets.flatMap((t) => collectTuffFiles(t))),
    ];
    if (files.length === 0) {
      console.error("No .tuff files found for format command");
      process.exitCode = 1;
      return;
    }

    let changed = 0;
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const formattedResult = formatTuffSource(source, { tracePasses });
      if (!formattedResult.ok) {
        const diag = toDiagnostic(formattedResult.error);
        console.error(formatDiagnostic(diag));
        process.exitCode = 1;
        return;
      }
      const formatted = formattedResult.value;
      if (formatted !== source) {
        changed += 1;
        if (write) {
          fs.writeFileSync(filePath, formatted, "utf8");
        }
      }
    }

    if (check) {
      if (changed > 0) {
        console.error(
          `format check failed: ${changed} file(s) require formatting`,
        );
        process.exitCode = 1;
        return;
      }
      console.log(`format check passed: ${files.length} file(s)`);
      return;
    }

    console.log(
      `Formatted ${files.length} file(s); updated ${changed} file(s)`,
    );
    return;
  }

  let output = undefined;
  let moduleBaseDir = undefined;
  let jsonErrors = false;
  let requestedBackend = undefined;
  let lint = false;
  let noBorrow = false;
  let lintFix = false;
  let lintStrict = false;
  let tracePasses = false;
  let target = "js";
  let warningFlagsRequested = false;
  let warningFlagsStrict = false;
  const warningGroups = new Set<string>();
  const warningErrorGroups = new Set<string>();
  let optimizationLevel = "O0";
  let emitDebugInfo = false;
  let compileOnly = false;
  let languageStandard = "tuff2024";
  let diagnosticsColor: "auto" | "always" | "never" = "auto";
  let nativeBuild = false;
  let nativeOutput = undefined;
  let requestedCompiler = undefined;
  let profile = false;
  let certificatePath: string | undefined = undefined;
  let afterDoubleDash = false;
  const inputs = [];
  const unknownFlags = [];

  for (let i = 0; i < args.length; i++) {
    if (afterDoubleDash || !args[i].startsWith("-")) {
      inputs.push(args[i]);
      continue;
    }

    if (args[i] === "--") {
      afterDoubleDash = true;
      continue;
    }

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
      continue;
    }

    if (
      args[i] === "-Wall" ||
      args[i] === "-Wextra" ||
      args[i] === "--warnings"
    ) {
      warningFlagsRequested = true;
      if (args[i] === "-Wall" || args[i] === "--warnings") {
        warningGroups.add("all");
      }
      if (args[i] === "-Wextra") {
        warningGroups.add("extra");
      }
      continue;
    }
    if (args[i] === "-Wlint") {
      warningFlagsRequested = true;
      warningGroups.add("lint");
      continue;
    }
    if (args[i] === "-Werror") {
      warningFlagsRequested = true;
      warningFlagsStrict = true;
      continue;
    }
    if (args[i].startsWith("-Werror=")) {
      const group = args[i].slice("-Werror=".length).trim().toLowerCase();
      if (group === "lint" || group === "all" || group === "extra") {
        warningFlagsRequested = true;
        warningGroups.add(group);
        warningErrorGroups.add(group);
        continue;
      }
      unknownFlags.push(args[i]);
      continue;
    }
    if (args[i] === "-Wno-error") {
      warningFlagsStrict = false;
      lintStrict = false;
      continue;
    }
    if (args[i].startsWith("-Wno-error=")) {
      const group = args[i].slice("-Wno-error=".length).trim().toLowerCase();
      if (group === "lint" || group === "all" || group === "extra") {
        warningErrorGroups.delete(group);
        continue;
      }
      unknownFlags.push(args[i]);
      continue;
    }
    if (args[i].startsWith("-Wno-")) {
      const group = args[i].slice("-Wno-".length).trim().toLowerCase();
      if (group === "lint" || group === "all" || group === "extra") {
        warningGroups.delete(group);
        warningErrorGroups.delete(group);
        warningFlagsRequested = warningGroups.size > 0;
        continue;
      }
      unknownFlags.push(args[i]);
      continue;
    }
    if (args[i].startsWith("-W")) {
      const group = args[i].slice(2).trim().toLowerCase();
      const isKnownWarnGroup =
        group === "lint" || group === "all" || group === "extra";
      if (isKnownWarnGroup) {
        warningFlagsRequested = true;
        warningGroups.add(group);
        continue;
      }
      unknownFlags.push(args[i]);
      continue;
    }
    if (args[i] === "-w" || args[i] === "-Wno-lint") {
      warningFlagsRequested = false;
      warningFlagsStrict = false;
      lint = false;
      lintStrict = false;
      continue;
    }
    if (args[i] === "-c") {
      compileOnly = true;
      continue;
    }
    if (args[i] === "--native") {
      nativeBuild = true;
      continue;
    }
    if (args[i] === "--native-out") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --native-out");
        process.exitCode = 1;
        return;
      }
      nativeOutput = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (args[i] === "--cc") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --cc");
        process.exitCode = 1;
        return;
      }
      requestedCompiler = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--emit-certificate") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --emit-certificate");
        process.exitCode = 1;
        return;
      }
      certificatePath = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (args[i] === "--profile") {
      profile = true;
      continue;
    }
    if (args[i] === "-g") {
      emitDebugInfo = true;
      continue;
    }
    if (
      args[i] === "-O0" ||
      args[i] === "-O1" ||
      args[i] === "-O2" ||
      args[i] === "-O3" ||
      args[i] === "-Os"
    ) {
      optimizationLevel = args[i].slice(1);
      continue;
    }
    if (args[i].startsWith("-std=")) {
      const std = args[i].slice("-std=".length).trim();
      if (!std) {
        console.error("Missing value for -std");
        process.exitCode = 1;
        return;
      }
      languageStandard = std;
      continue;
    }
    if (args[i] === "-fdiagnostics-color") {
      diagnosticsColor = "always";
      continue;
    }
    if (args[i].startsWith("-fdiagnostics-color=")) {
      const mode = args[i]
        .slice("-fdiagnostics-color=".length)
        .trim()
        .toLowerCase();
      if (mode === "always" || mode === "never" || mode === "auto") {
        diagnosticsColor = mode;
        continue;
      }
      unknownFlags.push(args[i]);
      continue;
    }

    if (args[i] === "--module-base" || args[i] === "-I") {
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
    if (args[i] === "--color") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --color");
        process.exitCode = 1;
        return;
      }
      const colorValue = args[i + 1].trim().toLowerCase();
      if (
        colorValue !== "always" &&
        colorValue !== "never" &&
        colorValue !== "auto"
      ) {
        unknownFlags.push(`--color=${args[i + 1]}`);
        i += 1;
        continue;
      }
      diagnosticsColor = colorValue;
      i += 1;
      continue;
    }
    if (args[i].startsWith("--color=")) {
      const colorValue = args[i].slice("--color=".length).trim().toLowerCase();
      if (
        colorValue !== "always" &&
        colorValue !== "never" &&
        colorValue !== "auto"
      ) {
        unknownFlags.push(args[i]);
        continue;
      }
      diagnosticsColor = colorValue;
      continue;
    }
    if (args[i] === "--selfhost") {
      requestedBackend = "selfhost";
      continue;
    }
    if (args[i] === "--stage0") {
      console.error(
        "--stage0 is no longer supported; the selfhost backend is now the only backend.",
      );
      process.exitCode = 1;
      return;
    }
    if (args[i] === "--backend") {
      if (!args[i + 1] || args[i + 1].startsWith("-")) {
        console.error("Missing value for --backend");
        process.exitCode = 1;
        return;
      }
      requestedBackend = args[i + 1];
      i += 1;
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
    if (args[i] === "--no-borrow") {
      noBorrow = true;
      continue;
    }
    if (
      args[i] === "--trace-passes" ||
      args[i] === "-v" ||
      args[i] === "--verbose"
    ) {
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

  if (inputs.length === 0) {
    console.error("Missing input file");
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (inputs.length > 1) {
    console.error(
      `Expected exactly one input file, got ${inputs.length}. Multi-file linking is not available yet.`,
    );
    process.exitCode = 1;
    return;
  }

  const input = inputs[0];

  if (unknownFlags.length > 0) {
    const legacyModuleFlags = unknownFlags.filter(
      (flag) => flag === "--modules" || flag === "--no-modules",
    );
    if (legacyModuleFlags.length > 0) {
      console.error(
        `Legacy option(s): ${legacyModuleFlags.join(", ")}\nModule graph loading is always enabled for file compilation; remove these option(s).`,
      );
      process.exitCode = 1;
      return;
    }
    console.error(`Unknown option(s): ${unknownFlags.join(", ")}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const backend = requestedBackend ?? "selfhost";
  const strictViaGroups = [...warningErrorGroups].some(
    (group) => group === "lint" || group === "all" || group === "extra",
  );

  if (backend === "selfhost") {
    if (warningFlagsRequested || warningGroups.size > 0) lint = true;
    if (warningFlagsStrict || strictViaGroups) lintStrict = true;
  }

  if (tracePasses) {
    if (compileOnly) {
      console.log("info: -c accepted (compile-only is default behavior)");
    }
    if (emitDebugInfo) {
      console.log("info: -g accepted (debug metadata emission is reserved)");
    }
    if (optimizationLevel !== "O0") {
      console.log(
        `info: -${optimizationLevel} accepted (optimization pipeline reserved)`,
      );
    }
    if (languageStandard !== "tuff2024") {
      console.log(
        `info: -std=${languageStandard} accepted (dialect checks are reserved)`,
      );
    }
    if (backend !== "selfhost" && warningFlagsRequested) {
      console.log(
        "info: -W* flags accepted as compatibility options (selfhost backend enables lint-backed warnings)",
      );
    }
    if (diagnosticsColor !== "auto") {
      console.log(
        `info: diagnostics color mode set to '${diagnosticsColor}' (rendering policy hook active)`,
      );
    }
  }

  const _cliStart = Date.now();
  if (jsonErrors) {
    setCompilerQuietMode(true);
  }
  if (!jsonErrors) {
    process.stderr.write(`[tuffc] starting: ${input}\n`);
  }
  const result = compileFileResult(path.resolve(input), output, {
    backend,
    cSubstrateMode: nativeBuild ? "legacy" : undefined,
    enableModules: true,
    modules: {
      moduleBaseDir: moduleBaseDir ?? path.dirname(path.resolve(input)),
    },
    borrowcheck: {
      enabled: !noBorrow,
    },
    lint: {
      enabled: lint,
      fix: lintFix,
      mode: lintStrict ? "error" : "warn",
    },
    target,
    tracePasses,
  });

  if (!jsonErrors) {
    process.stderr.write(
      `[tuffc] finished in ${Date.now() - _cliStart}ms (${result.ok ? "ok" : "error"})\n`,
    );
  }
  if (!result.ok) {
    const diag = toDiagnostic(result.error);
    const useColor = shouldUseColor(diagnosticsColor);
    if (jsonErrors) {
      console.error(JSON.stringify(diag, undefined, 2));
    } else {
      console.error(formatDiagnostic(diag, useColor));
    }
    if (certificatePath) {
      const cert = buildCertificate({
        sourcePaths: [path.resolve(input)],
        compilerVersion: readVersion(),
        outcome: {
          success: false,
          diagnosticCodes: [diag.code].filter(Boolean),
        },
      });
      fs.writeFileSync(
        certificatePath,
        JSON.stringify(cert, undefined, 2),
        "utf8",
      );
      console.log(`Certificate written to ${certificatePath}`);
      const typPath0 = writeTypstSource(cert, certificatePath);
      if (typPath0) compileTypstToPdf(typPath0);
    }
    process.exitCode = 1;
    return;
  }

  if (certificatePath) {
    const cert = buildCertificate({
      sourcePaths: [path.resolve(input)],
      compilerVersion: readVersion(),
      outcome: { success: true, diagnosticCodes: [] },
    });
    fs.writeFileSync(
      certificatePath,
      JSON.stringify(cert, undefined, 2),
      "utf8",
    );
    console.log(`Certificate written to ${certificatePath}`);
    const typPath1 = writeTypstSource(cert, certificatePath);
    if (typPath1) compileTypstToPdf(typPath1);
  }

  const {
    outputPath,
    lintIssues = [],
    lintFixesApplied = 0,
    lintFixedSource = undefined,
    profileJson = "",
    profile: profileData = undefined,
  } = result.value;

  if (lintFix && typeof lintFixedSource === "string") {
    const absInput = path.resolve(input);
    fs.writeFileSync(absInput, lintFixedSource, "utf8");
    console.log(`Applied ${lintFixesApplied} lint auto-fix(es) to ${input}`);
  }

  console.log(`Compiled ${input} -> ${outputPath}`);

  if (profile) {
    if (typeof profileJson === "string" && profileJson.length > 0) {
      console.error(`[profile] ${profileJson}`);
    } else if (profileData !== undefined) {
      console.error(`[profile] ${JSON.stringify(profileData)}`);
    } else {
      console.error("[profile] {}");
    }
  }

  if (nativeBuild) {
    if (target !== "c" && target !== "c-split") {
      console.error(
        "--native is only supported when --target c or --target c-split is selected",
      );
      process.exitCode = 1;
      return;
    }

    const compiler = findNativeCompiler(requestedCompiler);
    if (!compiler) {
      console.error(
        requestedCompiler
          ? `Requested C compiler '${requestedCompiler}' was not found in PATH.`
          : "No C compiler found in PATH. Install clang/gcc or pass --cc <compiler>.",
      );
      process.exitCode = 1;
      return;
    }

    const nativeOut = nativeOutput ?? defaultNativeOutputPath(outputPath);
    const cSources =
      target === "c-split" ? splitManifestCFiles(outputPath) : [outputPath];
    if (cSources.length === 0) {
      console.error(
        `No C source files found for native build at ${outputPath}.`,
      );
      process.exitCode = 1;
      return;
    }
    const nativeResult = compileNativeC(cSources, nativeOut, compiler);
    if (!nativeResult.ok) {
      console.error(nativeResult.message);
      process.exitCode = 1;
      return;
    }

    console.log(`Native build succeeded: ${nativeOut}`);
  }

  if (lint) {
    const useColor = shouldUseColor(diagnosticsColor);
    printLintIssues(lintIssues);
    if (lintIssues.length > 0) {
      console.warn(
        colorize(
          `tuffc: ${lintIssues.length} warning(s) generated.`,
          33,
          useColor,
        ),
      );
    }
    if (lintStrict && lintIssues.length > 0) {
      process.exitCode = 1;
    }
  }
}

main(process.argv);
