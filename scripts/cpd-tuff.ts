/**
 * Tuff CPD (Copy/Paste Detector).
 *
 * Detects duplicated token sequences in `.tuff` files using the selfhost lexer,
 * with PMD-CPD-like minimum-token windows.
 */
import fs from "node:fs";
import path from "node:path";
import { compileAndLoadSelfhost } from "../src/test/js/selfhost-harness.ts";
import { getProjectRoot, SelfhostCpdBridge } from "./common-scan-roots.ts";

const root = getProjectRoot(import.meta.url);

export type CpdOptions = {
  minTokens: number;
  targetDir: string;
  includeTests: boolean;
  failOnDupes: boolean;
  json: boolean;
  maxReports: number;
  normalizeIdentifiers: boolean;
  normalizeLiterals: boolean;
  exclude: string[];
};

export type CpdFile = {
  absPath: string;
  relPath: string;
};

type CpdToken = {
  kind: number;
  value: number;
  line: number;
  col: number;
  tokenId: number;
};

type CpdFileTokens = {
  file: CpdFile;
  tokens: CpdToken[];
};

type WindowMatch = {
  fileIndexA: number;
  startA: number;
  fileIndexB: number;
  startB: number;
  length: number;
};

type Finding = {
  fileA: string;
  fileB: string;
  startLineA: number;
  endLineA: number;
  startLineB: number;
  endLineB: number;
  tokens: number;
};

type CpdSummary = {
  scannedFiles: number;
  minTokens: number;
  totalTokens: number;
  elapsedMs: number;
  findings: Finding[];
  mode: "strict" | "informational";
};

const TK_KEYWORD = 1;
const TK_IDENTIFIER = 2;
const TK_NUMBER = 3;
const TK_STRING = 4;
const TK_BOOL = 5;
const TK_SYMBOL = 6;
const TK_CHAR = 7;

const HASH_MOD = 2_147_483_647;
const HASH_BASE = 911_382_323;

function printHelp(): void {
  console.log(
    `Usage: tsx ./scripts/cpd-tuff.ts [options]\n\nOptions:\n  --dir <path>               Scan root (default: src/main/tuff)\n  --min-tokens <n>           Minimum token window (default: 100)\n  --max-reports <n>          Max findings to print (default: 50)\n  --include-tests            Include src/test/tuff as well\n  --exclude <glob-like>      Exclude paths containing this substring (repeatable)\n  --normalize-identifiers    Treat all identifiers as one canonical token\n  --normalize-literals       Treat all literals as one canonical token\n  --fail-on-duplicates       Exit non-zero when findings > 0\n  --json                     Emit JSON summary\n  -h, --help                 Show this help\n`,
  );
}

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(
      `[cpd:tuff] Invalid ${flag} value '${raw}'. Expected a positive integer.`,
    );
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
    maxReports: 50,
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

    if (arg === "--max-reports") {
      const raw = argv[i + 1];
      if (raw == null) {
        console.error("[cpd:tuff] Missing value for --max-reports");
        process.exit(1);
      }
      options.maxReports = parsePositiveInt(raw, "--max-reports");
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
      ...collectTuffFiles(
        path.join(root, "src", "test", "tuff"),
        options.exclude,
      ),
    );
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return files;
}

function modPow(base: number, exponent: number, mod: number): number {
  let result = 1;
  let b = base % mod;
  let e = exponent;
  while (e > 0) {
    if ((e & 1) === 1) {
      result = (result * b) % mod;
    }
    b = (b * b) % mod;
    e >>= 1;
  }
  return result;
}

function buildTokenId(
  kind: number,
  value: number,
  options: CpdOptions,
): number {
  const canonicalValue = (() => {
    if (options.normalizeIdentifiers && kind === TK_IDENTIFIER) {
      return 1;
    }
    if (
      options.normalizeLiterals &&
      (kind === TK_NUMBER ||
        kind === TK_STRING ||
        kind === TK_CHAR ||
        kind === TK_BOOL)
    ) {
      return 1;
    }
    return value + 2;
  })();

  // Keep symbol/keyword/value distinctions while fitting in safe integer space.
  return kind * 1_000_003 + canonicalValue;
}

function tokenizeFile(
  bridge: SelfhostCpdBridge,
  file: CpdFile,
  options: CpdOptions,
): CpdFileTokens {
  const source = fs.readFileSync(file.absPath, "utf8");
  bridge.cpd_lex_init(source);
  const count = bridge.cpd_lex_all();
  const tokens: CpdToken[] = [];
  for (let i = 0; i < count; i++) {
    const kind = bridge.cpd_tok_kind(i);
    const value = bridge.cpd_tok_value(i);
    const line = bridge.cpd_tok_line(i);
    const col = bridge.cpd_tok_col(i);
    tokens.push({
      kind,
      value,
      line,
      col,
      tokenId: buildTokenId(kind, value, options),
    });
  }
  return { file, tokens };
}

function tokensEqual(
  a: CpdToken[],
  startA: number,
  b: CpdToken[],
  startB: number,
  length: number,
): boolean {
  for (let i = 0; i < length; i++) {
    if (a[startA + i]?.tokenId !== b[startB + i]?.tokenId) {
      return false;
    }
  }
  return true;
}

function computePrefixHashes(tokens: CpdToken[]): number[] {
  const prefix = new Array<number>(tokens.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < tokens.length; i++) {
    prefix[i + 1] = (prefix[i] * HASH_BASE + tokens[i].tokenId + 1) % HASH_MOD;
  }
  return prefix;
}

function windowHash(
  prefix: number[],
  start: number,
  length: number,
  basePow: number,
): number {
  const end = start + length;
  const raw =
    (prefix[end] - ((prefix[start] * basePow) % HASH_MOD) + HASH_MOD) %
    HASH_MOD;
  return raw;
}

function extendMatchLength(
  a: CpdToken[],
  startA: number,
  b: CpdToken[],
  startB: number,
  minLength: number,
): number {
  let length = minLength;
  while (startA + length < a.length && startB + length < b.length) {
    if (a[startA + length].tokenId !== b[startB + length].tokenId) {
      break;
    }
    length++;
  }
  return length;
}

function findWindowMatches(
  fileTokens: CpdFileTokens[],
  minTokens: number,
): WindowMatch[] {
  const hashBuckets = new Map<
    number,
    Array<{ fileIndex: number; start: number }>
  >();
  const prefixByFile = fileTokens.map((x) => computePrefixHashes(x.tokens));
  const basePow = modPow(HASH_BASE, minTokens, HASH_MOD);
  const matches: WindowMatch[] = [];
  const seen = new Set<string>();

  for (let fileIndex = 0; fileIndex < fileTokens.length; fileIndex++) {
    const tokens = fileTokens[fileIndex].tokens;
    if (tokens.length < minTokens) {
      continue;
    }
    const prefix = prefixByFile[fileIndex];
    for (let start = 0; start <= tokens.length - minTokens; start++) {
      const hash = windowHash(prefix, start, minTokens, basePow);
      const bucket = hashBuckets.get(hash) ?? [];

      for (const candidate of bucket) {
        const otherTokens = fileTokens[candidate.fileIndex].tokens;

        // Avoid trivial overlap within the same file.
        if (candidate.fileIndex === fileIndex) {
          const left = candidate.start;
          const right = start;
          const overlaps = !(
            left + minTokens <= right || right + minTokens <= left
          );
          if (overlaps) {
            continue;
          }
        }

        if (
          !tokensEqual(otherTokens, candidate.start, tokens, start, minTokens)
        ) {
          continue;
        }

        const length = extendMatchLength(
          otherTokens,
          candidate.start,
          tokens,
          start,
          minTokens,
        );

        const aFile = candidate.fileIndex;
        const aStart = candidate.start;
        const bFile = fileIndex;
        const bStart = start;
        const ordered =
          aFile < bFile || (aFile === bFile && aStart <= bStart)
            ? [aFile, aStart, bFile, bStart]
            : [bFile, bStart, aFile, aStart];
        const key = `${ordered[0]}:${ordered[1]}:${ordered[2]}:${ordered[3]}:${length}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({
            fileIndexA: ordered[0],
            startA: ordered[1],
            fileIndexB: ordered[2],
            startB: ordered[3],
            length,
          });
        }
      }

      bucket.push({ fileIndex, start });
      hashBuckets.set(hash, bucket);
    }
  }

  return matches;
}

function compareByPosition(x: Finding, y: Finding): number {
  if (x.fileA !== y.fileA) return x.fileA.localeCompare(y.fileA);
  if (x.startLineA !== y.startLineA) return x.startLineA - y.startLineA;
  if (x.fileB !== y.fileB) return x.fileB.localeCompare(y.fileB);
  if (x.startLineB !== y.startLineB) return x.startLineB - y.startLineB;
  return 0;
}

function toFindings(
  fileTokens: CpdFileTokens[],
  matches: WindowMatch[],
): Finding[] {
  const findings: Finding[] = [];
  for (const m of matches) {
    const a = fileTokens[m.fileIndexA];
    const b = fileTokens[m.fileIndexB];
    const startTokA = a.tokens[m.startA];
    const endTokA = a.tokens[m.startA + m.length - 1];
    const startTokB = b.tokens[m.startB];
    const endTokB = b.tokens[m.startB + m.length - 1];
    if (!startTokA || !endTokA || !startTokB || !endTokB) {
      continue;
    }
    findings.push({
      fileA: a.file.relPath,
      fileB: b.file.relPath,
      startLineA: startTokA.line,
      endLineA: endTokA.line,
      startLineB: startTokB.line,
      endLineB: endTokB.line,
      tokens: m.length,
    });
  }

  findings.sort((x, y) => {
    if (x.tokens !== y.tokens) return y.tokens - x.tokens;
    return compareByPosition(x, y);
  });

  const consolidated: Finding[] = [];
  for (const candidate of findings) {
    const subsumed = consolidated.some((kept) => {
      if (kept.fileA !== candidate.fileA || kept.fileB !== candidate.fileB) {
        return false;
      }
      const aCovered =
        kept.startLineA <= candidate.startLineA &&
        kept.endLineA >= candidate.endLineA;
      const bCovered =
        kept.startLineB <= candidate.startLineB &&
        kept.endLineB >= candidate.endLineB;
      return aCovered && bCovered;
    });
    if (!subsumed) {
      consolidated.push(candidate);
    }
  }

  consolidated.sort((x, y) => {
    const pos = compareByPosition(x, y);
    return pos !== 0 ? pos : y.tokens - x.tokens;
  });

  return consolidated;
}

function printSummary(summary: CpdSummary, options: CpdOptions): void {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[cpd:tuff] scanned files : ${summary.scannedFiles}`);
  console.log(`[cpd:tuff] total tokens  : ${summary.totalTokens}`);
  console.log(`[cpd:tuff] min tokens    : ${summary.minTokens}`);
  console.log(`[cpd:tuff] findings      : ${summary.findings.length}`);
  console.log(`[cpd:tuff] mode          : ${summary.mode}`);
  console.log(`[cpd:tuff] elapsed ms    : ${summary.elapsedMs}`);

  const previewCount = Math.min(summary.findings.length, options.maxReports);
  for (let i = 0; i < previewCount; i++) {
    const f = summary.findings[i];
    console.log(
      `[cpd:tuff] duplicate #${i + 1}: ${f.fileA}:${f.startLineA}-${f.endLineA} ↔ ${f.fileB}:${f.startLineB}-${f.endLineB} (${f.tokens} tokens)`,
    );
  }
  if (summary.findings.length > previewCount) {
    console.log(
      `[cpd:tuff] ... ${summary.findings.length - previewCount} more duplicate block(s) omitted`,
    );
  }
}

function run(): void {
  const started = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const files = collectFiles(options);
  const { selfhost } = compileAndLoadSelfhost(
    root,
    path.join(root, "tests", "out", "cpd"),
  );
  const bridge = selfhost as unknown as SelfhostCpdBridge;

  const fileTokens: CpdFileTokens[] = [];
  for (const file of files) {
    fileTokens.push(tokenizeFile(bridge, file, options));
  }

  const windowMatches = findWindowMatches(fileTokens, options.minTokens);
  const findings = toFindings(fileTokens, windowMatches);

  const summary: CpdSummary = {
    scannedFiles: files.length,
    minTokens: options.minTokens,
    totalTokens: fileTokens.reduce((acc, cur) => acc + cur.tokens.length, 0),
    elapsedMs: Date.now() - started,
    findings,
    mode: options.failOnDupes ? "strict" : "informational",
  };

  printSummary(summary, options);

  if (summary.findings.length > 0 && options.failOnDupes) {
    console.error(
      `[cpd:tuff] strict mode failed: found ${summary.findings.length} duplicate block(s) at threshold ${summary.minTokens}`,
    );
    process.exit(2);
  }
  process.exit(0);
}

run();
