/**
 * Migration script: rename all snake_case identifiers in .tuff source files to camelCase.
 *
 * Uses the selfhost CPD lexer to tokenise each file accurately — only TK_IDENTIFIER
 * tokens are renamed, never keywords, string literals, comments, or symbols.
 *
 * Usage:
 *   npx tsx ./scripts/rename-snake-to-camel.ts            # dry-run (preview only)
 *   npx tsx ./scripts/rename-snake-to-camel.ts --apply    # write files
 *   npx tsx ./scripts/rename-snake-to-camel.ts --apply --verbose
 *
 * After running with --apply you must also update src/main/js/runtime.ts (and any
 * tuff-js/*.js) for any extern-binding names that were renamed.  The script prints
 * a summary of which extern-binding identifiers were affected.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileAndLoadSelfhost } from "../src/test/js/selfhost-harness.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");

if (!APPLY) {
  console.log("[rename] Dry-run mode — pass --apply to write changes.\n");
}

// ---------------------------------------------------------------------------
// Load selfhost lexer
// ---------------------------------------------------------------------------
const outDir = path.join(root, "tests", "out", "rename-snake-to-camel");
fs.mkdirSync(outDir, { recursive: true });

const { selfhost } = compileAndLoadSelfhost(root, outDir) as {
  selfhost: {
    cpd_lex_init(source: string): number;
    cpd_lex_all(): number;
    cpd_tok_kind(idx: number): number;
    cpd_tok_value(idx: number): number;
    cpd_tok_line(idx: number): number;
    cpd_tok_col(idx: number): number;
    cpd_get_interned_str(idx: number): string;
  };
};

// ---------------------------------------------------------------------------
// Token kinds (must match selfhost/cpd constants)
// ---------------------------------------------------------------------------
const TK_IDENTIFIER = 2;

// ---------------------------------------------------------------------------
// Tuff source files to process
// ---------------------------------------------------------------------------
function collectTuffFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectTuffFiles(abs));
    else if (entry.isFile() && entry.name.endsWith(".tuff")) result.push(abs);
  }
  return result.sort();
}

const SCAN_DIRS = [
  path.join(root, "src", "main", "tuff"),
  path.join(root, "src", "main", "tuff-core"),
  path.join(root, "src", "main", "tuff-js"),
  path.join(root, "src", "main", "tuff-c"),
  path.join(root, "src", "test", "tuff"),
];

const allFiles = SCAN_DIRS.flatMap(collectTuffFiles);
console.log(`[rename] Scanning ${allFiles.length} .tuff files...\n`);

// ---------------------------------------------------------------------------
// snake_case → camelCase conversion
// ---------------------------------------------------------------------------
function snakeToCamel(name: string): string {
  // Only rename identifiers that look like word_word (no leading/trailing _,
  // no double __, not purely uppercase like I32/Vec/Bool).
  if (!name.includes("_")) return name;
  if (name.startsWith("_") || name.endsWith("_")) return name;
  if (name.includes("__")) return name; // double-underscore = internal ABI magic

  const parts = name.split("_");
  // If every part is all-uppercase it's likely a constant like FOO_BAR — keep as-is.
  if (parts.every((p) => p === p.toUpperCase() && /^[A-Z]/.test(p)))
    return name;

  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  );
}

// ---------------------------------------------------------------------------
// Build line-start offset table for a source string
// ---------------------------------------------------------------------------
function buildLineOffsets(source: string): number[] {
  const offsets: number[] = [0]; // line 1 starts at offset 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

// ---------------------------------------------------------------------------
// For each token, resolve the character offset by verifying against the source.
// The lexer uses 1-indexed lines; columns appear to be 0-indexed.
// We verify both possibilities and pick the one that matches.
// ---------------------------------------------------------------------------
function resolveOffset(
  source: string,
  lineOffsets: number[],
  line: number,
  col: number,
  name: string,
): number | null {
  const lineStart = lineOffsets[line - 1];
  if (lineStart === undefined) return null;

  // Try col as 0-indexed first, then 1-indexed.
  for (const c of [col, col - 1]) {
    const off = lineStart + c;
    if (off < 0 || off + name.length > source.length) continue;
    if (source.slice(off, off + name.length) === name) return off;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detect if a token at position `idx` sits inside an `extern let { … }` block.
// We do a simple scan backward through the raw token sequence when context matters.
// ---------------------------------------------------------------------------
type TokenSnapshot = { kind: number; name: string; line: number; col: number };

function classifyExternLets(tokens: TokenSnapshot[]): Set<number> {
  // Returns the set of token indices that sit inside `extern let { … }` destructure bodies.
  // We walk forward: when we see keyword "extern" followed by keyword "let" followed by "{",
  // all TK_IDENTIFIER tokens until the matching "}" are extern-binding names.
  const externBindingIndices = new Set<number>();
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind !== 1 /* TK_KEYWORD */ || t.name !== "extern") {
      i++;
      continue;
    }
    // Look ahead for "let" keyword
    let j = i + 1;
    if (j >= tokens.length || tokens[j].name !== "let") {
      i++;
      continue;
    }
    j++;
    // Skip optional qualifiers
    while (j < tokens.length && tokens[j].kind === 1 /* keyword */) j++;
    // Expect "{"
    if (j >= tokens.length || tokens[j].name !== "{") {
      i++;
      continue;
    }
    j++;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      const tok = tokens[j];
      if (tok.name === "{") depth++;
      else if (tok.name === "}") depth--;
      else if (depth === 1 && tok.kind === TK_IDENTIFIER) {
        externBindingIndices.add(j);
      }
      j++;
    }
    i = j;
  }
  return externBindingIndices;
}

// ---------------------------------------------------------------------------
// Process one file: return the patched source (or null if no changes needed)
// ---------------------------------------------------------------------------
type FileResult = {
  filePath: string;
  relPath: string;
  original: string;
  patched: string;
  renames: number;
  externRenames: Map<string, string>;
  failed: Array<{ name: string; line: number; col: number }>;
};

function processFile(filePath: string): FileResult {
  const original = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(root, filePath).replaceAll("\\", "/");

  selfhost.cpd_lex_init(original);
  const tokenCount = selfhost.cpd_lex_all();

  const lineOffsets = buildLineOffsets(original);

  // Collect token snapshots (for extern-let classification)
  const snapshots: TokenSnapshot[] = [];
  for (let i = 0; i < tokenCount; i++) {
    const kind = selfhost.cpd_tok_kind(i);
    const value = selfhost.cpd_tok_value(i);
    const name =
      kind === TK_IDENTIFIER
        ? selfhost.cpd_get_interned_str(value)
        : (() => {
            // For keywords/symbols, also get the interned string so we can check e.g. "extern"
            try {
              return selfhost.cpd_get_interned_str(value);
            } catch {
              return "";
            }
          })();
    snapshots.push({
      kind,
      name,
      line: selfhost.cpd_tok_line(i),
      col: selfhost.cpd_tok_col(i),
    });
  }

  const externBindingIndices = classifyExternLets(snapshots);

  type Replacement = { offset: number; length: number; newName: string };
  const replacements: Replacement[] = [];
  const failed: FileResult["failed"] = [];
  const externRenames = new Map<string, string>();

  for (let i = 0; i < snapshots.length; i++) {
    const tok = snapshots[i];
    if (tok.kind !== TK_IDENTIFIER) continue;

    const newName = snakeToCamel(tok.name);
    if (newName === tok.name) continue;

    const offset = resolveOffset(
      original,
      lineOffsets,
      tok.line,
      tok.col,
      tok.name,
    );
    if (offset === null) {
      failed.push({ name: tok.name, line: tok.line, col: tok.col });
      continue;
    }

    if (externBindingIndices.has(i)) {
      externRenames.set(tok.name, newName);
    }

    replacements.push({ offset, length: tok.name.length, newName });
  }

  // Deduplicate replacements at the same offset (same token appearing multiple times
  // due to re-lex state resets shouldn't happen, but guard anyway).
  const seen = new Set<number>();
  const deduped = replacements.filter((r) => {
    if (seen.has(r.offset)) return false;
    seen.add(r.offset);
    return true;
  });

  // Apply replacements in reverse order so earlier offsets stay valid.
  deduped.sort((a, b) => b.offset - a.offset);

  let patched = original;
  for (const r of deduped) {
    patched =
      patched.slice(0, r.offset) +
      r.newName +
      patched.slice(r.offset + r.length);
  }

  return {
    filePath,
    relPath,
    original,
    patched,
    renames: deduped.length,
    externRenames,
    failed,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let totalFiles = 0;
let totalRenames = 0;
let totalFailed = 0;
const allExternRenames = new Map<string, string>();

for (const filePath of allFiles) {
  const result = processFile(filePath);
  totalFiles++;

  if (result.renames === 0 && result.failed.length === 0) continue;

  if (VERBOSE || result.renames > 0) {
    console.log(
      `[rename] ${result.relPath}: ${result.renames} rename(s)` +
        (result.failed.length > 0
          ? `, ${result.failed.length} position-verify failure(s)`
          : ""),
    );
  }

  for (const [old, n] of result.externRenames) {
    allExternRenames.set(old, n);
  }

  for (const f of result.failed) {
    console.warn(
      `  ⚠ Could not verify position for '${f.name}' at ${result.relPath}:${f.line}:${f.col}`,
    );
    totalFailed++;
  }

  totalRenames += result.renames;

  if (APPLY && result.patched !== result.original) {
    fs.writeFileSync(result.filePath, result.patched, "utf8");
  }
}

console.log(
  `\n[rename] ${APPLY ? "Applied" : "Would apply"} ${totalRenames} rename(s) across ${totalFiles} file(s).`,
);
if (totalFailed > 0) {
  console.warn(
    `[rename] ${totalFailed} position-verify failure(s) — those tokens were skipped.`,
  );
}

if (allExternRenames.size > 0) {
  console.log(
    "\n[rename] ⚠  The following extern-binding names were also renamed.\n" +
      "  You must update src/main/js/runtime.ts and any tuff-js/*.js files\n" +
      "  to export the new camelCase names (or alias the old ones):\n",
  );
  for (const [old, n] of [...allExternRenames].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`    ${old}  →  ${n}`);
  }
}
