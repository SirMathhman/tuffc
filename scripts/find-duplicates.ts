#!/usr/bin/env bun
/**
 * find-duplicates.ts
 *
 * Detect structurally duplicate code at the TypeScript AST level.
 * This is NOT a token-based tool; it operates purely on syntax-tree shape.
 *
 * Usage:
 *   bun scripts/find-duplicates.ts [options] [paths...]
 *
 * Options:
 *   --min-nodes  <n>        Minimum AST node count per candidate (default: 25)
 *   --min-lines  <n>        Minimum source-line span per candidate (default: 3)
 *   --min-occurrences <n>   Minimum occurrences to report a clone class (default: 2)
 *   --no-normalize-ids      Disable identifier normalisation (strict structural match)
 *   --normalize-literals    Enable literal value normalisation
 *   --no-type-annotations   Exclude type annotation nodes from the canonical form
 *   --suppress-nested       Suppress clone classes fully contained in a larger class
 *   --json                  Emit machine-readable JSON instead of text
 *   --help                  Show this help and exit
 *
 * Paths can be files or directories; directories are walked recursively.
 * If no paths are given, defaults to the current working directory.
 */

import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, extname } from "path";

import { stableHash } from "./lib/hash.js";
import {
  canonicalize,
  DEFAULT_OPTIONS,
  type CanonicalizeOptions,
} from "./lib/ast-canonicalize.js";
import { collectCandidates } from "./lib/candidates.js";
import {
  suppressNested,
  formatText,
  formatJson,
  type CloneClass,
  type Occurrence,
} from "./lib/report.js";

// ── CLI parsing ────────────────────────────────────────────────────────────────

interface CliOptions {
  paths: string[];
  minNodes: number;
  minLines: number;
  minOccurrences: number;
  canonical: CanonicalizeOptions;
  suppressNestedFlag: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    paths: [],
    minNodes: 25,
    minLines: 3,
    minOccurrences: 2,
    canonical: { ...DEFAULT_OPTIONS },
    suppressNestedFlag: false,
    json: false,
  };

  const args = argv.slice(2); // strip 'bun' + script path

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--min-nodes":
        opts.minNodes = Number(args[++i]);
        break;
      case "--min-lines":
        opts.minLines = Number(args[++i]);
        break;
      case "--min-occurrences":
        opts.minOccurrences = Number(args[++i]);
        break;
      case "--no-normalize-ids":
        opts.canonical.normalizeIdentifiers = false;
        break;
      case "--normalize-literals":
        opts.canonical.normalizeLiterals = true;
        break;
      case "--no-type-annotations":
        opts.canonical.keepTypeAnnotations = false;
        break;
      case "--suppress-nested":
        opts.suppressNestedFlag = true;
        break;
      case "--json":
        opts.json = true;
        break;
      default:
        if (!arg.startsWith("--")) {
          opts.paths.push(arg);
        } else {
          console.error("Unknown option: " + arg);
          process.exit(1);
        }
    }
  }

  if (opts.paths.length === 0) {
    opts.paths.push(process.cwd());
  }

  return opts;
}

function printHelp(): void {
  console.log(
    "\n" +
      "find-duplicates — AST-level duplicate code detector for TypeScript\n" +
      "\n" +
      "Usage:\n" +
      "  bun scripts/find-duplicates.ts [options] [paths...]\n" +
      "\n" +
      "Options:\n" +
      "  --min-nodes  <n>         Min AST node count per candidate   (default: 25)\n" +
      "  --min-lines  <n>         Min source-line span per candidate (default: 3)\n" +
      "  --min-occurrences <n>    Min occurrences to surface a clone (default: 2)\n" +
      "  --no-normalize-ids       Exact identifier matching (disables Type-2 detection)\n" +
      "  --normalize-literals     Normalise string/number literal values\n" +
      "  --no-type-annotations    Exclude type annotations from the canonical form\n" +
      "  --suppress-nested        Hide clone classes subsumed by larger ones\n" +
      "  --json                   Machine-readable JSON output\n" +
      "  --help                   Show this help\n" +
      "",
  );
}

// ── File discovery ─────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
]);
const TS_EXTS = new Set([".ts", ".tsx"]);

function collectFiles(inputPath: string): string[] {
  const abs = resolve(inputPath);
  const stat = statSync(abs);

  if (stat.isFile()) {
    return TS_EXTS.has(extname(abs)) ? [abs] : [];
  }

  if (stat.isDirectory()) {
    const results: string[] = [];
    for (const entry of readdirSync(abs)) {
      if (SKIP_DIRS.has(entry)) continue;
      results.push(...collectFiles(join(abs, entry)));
    }
    return results;
  }

  return [];
}

// ── Main ───────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv);

// 1. Collect all TypeScript files
const files: string[] = [];
for (const p of opts.paths) {
  files.push(...collectFiles(p));
}

if (files.length === 0) {
  console.error("No TypeScript files found in the given paths.");
  process.exit(1);
}

const hashMap = new Map<
  string,
  { occurrences: Occurrence[]; nodeCount: number }
>();

for (const filePath of files) {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TSX,
  );

  const candidates = collectCandidates(
    sourceFile,
    filePath,
    opts.minNodes,
    opts.minLines,
  );

  for (const cand of candidates) {
    const canonical = canonicalize(cand.node, opts.canonical);
    const hash = stableHash(canonical);

    const srcLines = sourceText.split("\n");
    const snippet = srcLines.slice(cand.lineStart - 1, cand.lineEnd).join("\n");

    const occ: Occurrence = {
      filePath: cand.filePath,
      lineStart: cand.lineStart,
      lineEnd: cand.lineEnd,
      nodeCount: cand.nodeCount,
      kindName: cand.kindName,
      snippet,
    };

    const bucket = hashMap.get(hash);
    if (bucket) {
      bucket.occurrences.push(occ);
    } else {
      hashMap.set(hash, { occurrences: [occ], nodeCount: cand.nodeCount });
    }
  }
}

let cloneClasses: CloneClass[] = [];
let id = 1;

for (const [hash, { occurrences, nodeCount }] of hashMap) {
  if (occurrences.length < opts.minOccurrences) continue;
  cloneClasses.push({ id: id++, hash, nodeCount, occurrences });
}

cloneClasses.sort((a, b) => b.nodeCount - a.nodeCount);

if (opts.suppressNestedFlag) {
  cloneClasses = suppressNested(cloneClasses);
}

const output = opts.json ? formatJson(cloneClasses) : formatText(cloneClasses);

process.stdout.write(output + "\n");
