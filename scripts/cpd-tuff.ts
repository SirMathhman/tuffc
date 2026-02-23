/**
 * Tuff CPD (Copy/Paste Detector) CLI scaffold.
 *
 * Phase 1: CLI contract + file discovery.
 * Phase 2+: lexer bridge + duplicate detection engine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");

export type CpdOptions = {
  minTokens: number;
  targetDir: string;
  includeTests: boolean;
  failOnDupes: boolean;
  json: boolean;
  normalizeIdentifiers: boolean;
  normalizeLiterals: boolean;
  exclude: string[];
};

export type CpdFile = {
  absPath: string;
  relPath: string;
};

type CpdSummary = {
  scannedFiles: number;
  minTokens: number;
  findings: number;
  mode: "strict" | "informational";
};

function printHelp(): void {
  console.log(`Usage: tsx ./scripts/cpd-tuff.ts [options]\n\nOptions:\n  --dir <path>               Scan root (default: src/main/tuff)\n  --min-tokens <n>           Minimum token window (default: 100)\n  --include-tests            Include src/test/tuff as well\n  --exclude <glob-like>      Exclude paths containing this substring (repeatable)\n  --normalize-identifiers    Treat all identifiers as one canonical token\n  --normalize-literals       Treat all literals as one canonical token\n  --fail-on-duplicates       Exit non-zero when findings > 0\n  --json                     Emit JSON summary\n  -h, --help                 Show this help\n`);
}

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`[cpd:tuff] Invalid ${flag} value '${raw}'. Expected a positive integer.`);
    process.exit(1);
  }
  return n;
}

export function parseArgs(argv: string[]): CpdOptions {
  const options: CpdOptions = {
    minTokens: 100,
    targetDir: path.join(root, "src", "main", "tuff"),
    includeTests: false,
    failOnDupes: false,
    json: false,
    normalizeIdentifiers: false,
    normalizeLiterals: false,
    exclude: [".generated.", "selfhost.js", "selfhost.generated.js"],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--min-tokens") {
      const raw = argv[i + 1];
      if (raw == null) {
        console.error("[cpd:tuff] Missing value for --min-tokens");
        process.exit(1);
      }
      options.minTokens = parsePositiveInt(raw, "--min-tokens");
      i++;
      continue;
    }

    if (arg === "--dir") {
      const raw = argv[i + 1];
      if (raw == null) {
        console.error("[cpd:tuff] Missing value for --dir");
        process.exit(1);
      }
      options.targetDir = path.resolve(root, raw);
      i++;
      continue;
    }

    if (arg === "--exclude") {
      const raw = argv[i + 1];
      if (raw == null) {
        console.error("[cpd:tuff] Missing value for --exclude");
        process.exit(1);
      }
      options.exclude.push(raw);
      i++;
      continue;
    }

    if (arg === "--include-tests") {
      options.includeTests = true;
      continue;
    }
    if (arg === "--fail-on-duplicates") {
      options.failOnDupes = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--normalize-identifiers") {
      options.normalizeIdentifiers = true;
      continue;
    }
    if (arg === "--normalize-literals") {
      options.normalizeLiterals = true;
      continue;
    }

    console.error(`[cpd:tuff] Unknown argument '${arg}'`);
    process.exit(1);
  }

  return options;
}

function shouldExclude(relPath: string, excludes: string[]): boolean {
  return excludes.some((needle) => relPath.includes(needle));
}

function collectTuffFiles(dir: string, excludes: string[]): CpdFile[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: CpdFile[] = [];
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(root, absPath).replaceAll("\\", "/");
    if (shouldExclude(relPath, excludes)) {
      continue;
    }
    if (entry.isDirectory()) {
      out.push(...collectTuffFiles(absPath, excludes));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tuff")) {
      out.push({ absPath, relPath });
    }
  }
  return out;
}

function collectFiles(options: CpdOptions): CpdFile[] {
  const files = collectTuffFiles(options.targetDir, options.exclude);
  if (options.includeTests) {
    files.push(
      ...collectTuffFiles(path.join(root, "src", "test", "tuff"), options.exclude),
    );
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return files;
}

function printSummary(summary: CpdSummary, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[cpd:tuff] scanned files : ${summary.scannedFiles}`);
  console.log(`[cpd:tuff] min tokens    : ${summary.minTokens}`);
  console.log(`[cpd:tuff] findings      : ${summary.findings}`);
  console.log(`[cpd:tuff] mode          : ${summary.mode}`);
}

function run(): void {
  const options = parseArgs(process.argv.slice(2));
  const files = collectFiles(options);

  // Phase 1 scaffold: no matching yet.
  const summary: CpdSummary = {
    scannedFiles: files.length,
    minTokens: options.minTokens,
    findings: 0,
    mode: options.failOnDupes ? "strict" : "informational",
  };

  printSummary(summary, options.json);
  process.exit(0);
}

run();
