import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Remove all Bun-specific API notes — now using plain Node.js.

interface Location {
  file: string;
  line: number;
  character: number;
  kind: string;
  text: string;
}

type BucketMap = Map<string, { locs: Location[]; nodeCount: number }>;

interface NodeEntry {
  loc: Location;
  nodeCount: number;
  childKeys: string[];
  key: string;
}

type KindRegistry = Map<ts.SyntaxKind, NodeEntry[]>;

interface PartialMatch {
  similarity: number;
  nodeCount: number;
  a: NodeEntry;
  b: NodeEntry;
}

/** Skip leading whitespace and // or /* comments from `pos`. */
function skipTrivia(content: string, pos: number): number {
  const len = content.length;
  const next = (offset = 1) => content[pos + offset];
  const nextIs = (ch: string) => next() === ch;
  while (pos < len) {
    const ch = content[pos];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      pos++;
    } else if (ch === "/" && pos + 1 < len) {
      if (nextIs("/")) {
        pos += 2;
        while (pos < len && content[pos] !== "\n") pos++;
      } else if (nextIs("*")) {
        pos += 2;
        while (pos < len - 1 && !(content[pos] === "*" && nextIs("/"))) pos++;
        pos += 2;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return pos;
}

/** Build a lookup array of byte offsets where each line starts (0-indexed). */
function buildLineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

/** Binary-search lineStarts to get 1-based line + character for a byte offset. */
function posToLineChar(
  lineStarts: number[],
  tokenStart: number,
): { line: number; character: number } {
  let lo = 0,
    hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= tokenStart) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, character: tokenStart - lineStarts[lo] + 1 };
}

/** Flatten SyntaxList, TypeReference, and VariableDeclarationList nodes out of existence — return their children inline. */
function isTransparent(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.SyntaxList ||
    kind === ts.SyntaxKind.TypeReference ||
    kind === ts.SyntaxKind.VariableDeclarationList
  );
}

function getEffectiveChildren(node: ts.Node, sf: ts.SourceFile): ts.Node[] {
  const result: ts.Node[] = [];
  const pending = [...node.getChildren(sf)];
  while (pending.length > 0) {
    const child = pending.shift()!;
    if (isTransparent(child.kind)) {
      pending.unshift(...child.getChildren(sf));
    } else if (child.kind === ts.SyntaxKind.VariableDeclaration) {
      const init = (child as ts.VariableDeclaration).initializer;
      if (init) result.push(init);
    } else if (child.kind === ts.SyntaxKind.PropertyAssignment) {
      result.push((child as ts.PropertyAssignment).initializer);
    } else {
      result.push(child);
    }
  }
  return result;
}

// Iterative post-order serialization — avoids recursion and all crashing TS APIs.
function serialize(
  root: ts.Node,
  sf: ts.SourceFile,
  content: string,
): { key: string; childKeys: string[] } {
  type Frame = {
    node: ts.Node;
    children: ts.Node[];
    idx: number;
    childKeys: string[];
  };
  const stack: Frame[] = [
    {
      node: root,
      children: getEffectiveChildren(root, sf),
      idx: 0,
      childKeys: [],
    },
  ];
  let result = "";
  let rootChildKeys: string[] = [];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.idx < frame.children.length) {
      const child = frame.children[frame.idx++];
      stack.push({
        node: child,
        children: getEffectiveChildren(child, sf),
        idx: 0,
        childKeys: [],
      });
    } else {
      stack.pop();
      const kind = ts.SyntaxKind[frame.node.kind];
      let key: string;
      if (frame.children.length === 0) {
        const tokenStart = skipTrivia(content, frame.node.pos);
        const text = content.slice(tokenStart, frame.node.end);
        key = `${kind}:${JSON.stringify(text)}`;
      } else {
        key = `${kind}(${frame.childKeys.join(",")})`;
      }
      if (stack.length > 0) {
        stack[stack.length - 1].childKeys.push(key);
      } else {
        result = key;
        rootChildKeys = frame.childKeys;
      }
    }
  }
  return { key: result, childKeys: rootChildKeys };
}

const LITERAL_KINDS = new Set([
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

function hasLiteralLeaf(root: ts.Node, sf: ts.SourceFile): boolean {
  const stack: ts.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (LITERAL_KINDS.has(node.kind)) return true;
    for (const child of node.getChildren(sf)) stack.push(child);
  }
  return false;
}

function countNodes(root: ts.Node, sf: ts.SourceFile): number {
  const stack: ts.Node[] = [root];
  let n = 0;
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (isTransparent(node.kind)) {
      for (const child of node.getChildren(sf)) stack.push(child);
    } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
      const init = (node as ts.VariableDeclaration).initializer;
      if (init) stack.push(init);
    } else if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      stack.push((node as ts.PropertyAssignment).initializer);
    } else {
      n++;
      for (const child of node.getChildren(sf)) stack.push(child);
    }
  }
  return n;
}

function jaccardKeys(a: string[], b: string[]): number {
  const freqA = new Map<string, number>();
  for (const k of a) freqA.set(k, (freqA.get(k) ?? 0) + 1);
  const freqB = new Map<string, number>();
  for (const k of b) freqB.set(k, (freqB.get(k) ?? 0) + 1);
  let intersection = 0;
  let union = 0;
  const allKeys = new Set([...freqA.keys(), ...freqB.keys()]);
  for (const k of allKeys) {
    const ca = freqA.get(k) ?? 0;
    const cb = freqB.get(k) ?? 0;
    intersection += Math.min(ca, cb);
    union += Math.max(ca, cb);
  }
  return union === 0 ? 0 : intersection / union;
}

function findPartialDuplicates(
  registry: KindRegistry,
  threshold: number,
  exactKeys: Set<string>,
): PartialMatch[] {
  const matches: PartialMatch[] = [];
  const seen = new Set<string>();
  for (const entries of registry.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.key === b.key) continue; // exact duplicate — already reported
        const pairId =
          a.key < b.key ? `${a.key}||${b.key}` : `${b.key}||${a.key}`;
        if (seen.has(pairId)) continue;
        seen.add(pairId);
        const sim = jaccardKeys(a.childKeys, b.childKeys);
        if (sim >= threshold) {
          matches.push({
            similarity: sim,
            nodeCount: Math.max(a.nodeCount, b.nodeCount),
            a,
            b,
          });
        }
      }
    }
  }
  return matches;
}

function walk(
  root: ts.Node,
  sf: ts.SourceFile,
  content: string,
  lineStarts: number[],
  filePath: string,
  map: BucketMap,
  registry: KindRegistry,
): void {
  const stack: ts.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (isTransparent(node.kind)) {
      for (const child of node.getChildren(sf)) stack.push(child);
      continue;
    }
    if (node.kind === ts.SyntaxKind.VariableDeclaration) {
      const init = (node as ts.VariableDeclaration).initializer;
      if (init) stack.push(init);
      continue;
    }
    if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      stack.push((node as ts.PropertyAssignment).initializer);
      continue;
    }
    // Skip trivial bare control-flow statements (return;  break;  continue;)
    if (
      (node.kind === ts.SyntaxKind.ReturnStatement &&
        !(node as ts.ReturnStatement).expression) ||
      (node.kind === ts.SyntaxKind.BreakStatement &&
        !(node as ts.BreakStatement).label) ||
      (node.kind === ts.SyntaxKind.ContinueStatement &&
        !(node as ts.ContinueStatement).label)
    ) {
      continue;
    }
    // Skip nodes whose subtree contains no literal values — all-identifier shapes are noise.
    if (!hasLiteralLeaf(node, sf)) {
      for (const child of node.getChildren(sf)) stack.push(child);
      continue;
    }
    const { key, childKeys } = serialize(node, sf, content);
    const tokenStart = skipTrivia(content, node.pos);
    const { line, character } = posToLineChar(lineStarts, tokenStart);
    const rawText = content.slice(tokenStart, node.end);
    const lines = rawText.split("\n");
    const snippet =
      lines.length <= 5 ? rawText : lines.slice(0, 5).join("\n") + " \u2026";
    const loc: Location = {
      file: filePath,
      line,
      character,
      kind: ts.SyntaxKind[node.kind],
      text: snippet,
    };
    const nodeCount = countNodes(node, sf);
    const bucket = map.get(key);
    if (bucket) {
      bucket.locs.push(loc);
    } else {
      map.set(key, { locs: [loc], nodeCount });
    }
    const entry: NodeEntry = { loc, nodeCount, childKeys, key };
    const kindEntries = registry.get(node.kind);
    if (kindEntries) {
      kindEntries.push(entry);
    } else {
      registry.set(node.kind, [entry]);
    }
    for (const child of node.getChildren(sf)) stack.push(child);
  }
}

function scanTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...scanTs(full));
    else if (entry.name.endsWith(".ts")) results.push(full);
  }
  return results;
}

function parseThreshold(): number {
  const idx = process.argv.indexOf("--threshold");
  if (idx === -1) return 0.8;
  const raw = process.argv[idx + 1];
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0 || val >= 1) {
    console.error(`--threshold must be a number in (0, 1), got: ${raw}`);
    process.exit(1);
  }
  return val;
}

function printLocation(root: string, loc: Location): void {
  const rel = path.relative(root, loc.file).replace(/\\/g, "/");
  console.log(`  ${rel}:${loc.line}:${loc.character}`);
  for (const line of loc.text.split("\n")) console.log(`    ${line}`);
}

function nodeHeader(nodeCount: number, kind: string, suffix: string): string {
  return `[${nodeCount} node(s)] ${kind} \u2014 ${suffix}`;
}

async function main(): Promise<void>  {
  const threshold = parseThreshold();
  const root = path.resolve(__dirname, "..");
  const scanDirs = ["src", "scripts"];
  const files = scanDirs.flatMap((dir) => scanTs(path.join(root, dir)));

  if (files.length === 0) {
    console.log("No TypeScript files found.");
    return;
  }

  const map: BucketMap = new Map();
  const registry: KindRegistry = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lineStarts = buildLineStarts(content);
    const sf = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );
    for (const node of sf.getChildren(sf))
      walk(node, sf, content, lineStarts, filePath, map, registry);
  }

  const duplicates = [...map.entries()]
    .filter(([, v]) => v.locs.length >= 2 && v.nodeCount >= 2)
    .sort(
      ([, a], [, b]) =>
        b.nodeCount - a.nodeCount || b.locs.length - a.locs.length,
    );

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} exact duplicate AST subtree(s):\n`);
    for (const [key, { locs, nodeCount }] of duplicates) {
      const preview = key.length > 100 ? key.slice(0, 100) + "\u2026" : key;
      console.log(
        nodeHeader(nodeCount, locs[0].kind, `${locs.length} occurrence(s)`),
      );
      console.log(`  Key: ${preview}`);
      for (const loc of locs) printLocation(root, loc);
      console.log();
    }
  } else {
    console.log("No exact AST subtree duplicates found.\n");
  }

  const exactKeys = new Set(map.keys());
  const partial = findPartialDuplicates(registry, threshold, exactKeys).sort(
    (a, b) => b.similarity - a.similarity || b.nodeCount - a.nodeCount,
  );

  if (partial.length > 0) {
    const pct = Math.round(threshold * 100);
    console.log(
      `Found ${partial.length} partial duplicate(s) (>= ${pct}% similar):\n`,
    );
    for (const { similarity, nodeCount, a, b } of partial) {
      const simPct = Math.round(similarity * 100);
      console.log(nodeHeader(nodeCount, a.loc.kind, `${simPct}% similar`));
      printLocation(root, a.loc);
      printLocation(root, b.loc);
      console.log();
    }
  } else {
    console.log(
      `No partial duplicates found at threshold ${Math.round(threshold * 100)}%.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
