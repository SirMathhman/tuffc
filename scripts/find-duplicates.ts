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
function serialize(root: ts.Node, sf: ts.SourceFile, content: string): string {
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
      }
    }
  }
  return result;
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

function walk(
  root: ts.Node,
  sf: ts.SourceFile,
  content: string,
  lineStarts: number[],
  filePath: string,
  map: BucketMap,
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
    const key = serialize(node, sf, content);
    const tokenStart = skipTrivia(content, node.pos);
    const { line, character } = posToLineChar(lineStarts, tokenStart);
    const rawText = content.slice(tokenStart, node.end);
    const firstLine = rawText.indexOf("\n");
    const snippet =
      firstLine === -1 ? rawText : rawText.slice(0, firstLine) + " \u2026";
    const loc: Location = {
      file: filePath,
      line,
      character,
      kind: ts.SyntaxKind[node.kind],
      text: snippet,
    };
    const bucket = map.get(key);
    if (bucket) {
      bucket.locs.push(loc);
    } else {
      map.set(key, { locs: [loc], nodeCount: countNodes(node, sf) });
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

async function main(): Promise<void> {
  const root = path.resolve(__dirname, "..");
  const scanDirs = ["src", "scripts"];
  const files = scanDirs.flatMap((dir) => scanTs(path.join(root, dir)));

  if (files.length === 0) {
    console.log("No TypeScript files found.");
    return;
  }

  const map: BucketMap = new Map();

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
      walk(node, sf, content, lineStarts, filePath, map);
  }

  const duplicates = [...map.entries()]
    .filter(([, v]) => v.locs.length >= 2 && v.nodeCount >= 2)
    .sort(
      ([, a], [, b]) =>
        b.nodeCount - a.nodeCount || b.locs.length - a.locs.length,
    );

  if (duplicates.length === 0) {
    console.log("No AST subtree duplicates found.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate AST subtree(s):\n`);

  for (const [key, { locs, nodeCount }] of duplicates) {
    const preview = key.length > 100 ? key.slice(0, 100) + "…" : key;
    console.log(
      `[${nodeCount} node(s)] ${locs[0].kind} — ${locs.length} occurrence(s)`,
    );
    console.log(`  Key: ${preview}`);
    for (const loc of locs) {
      const rel = path.relative(root, loc.file).replace(/\\/g, "/");
      console.log(`  ${rel}:${loc.line}:${loc.character}`);
      const displayText =
        loc.text.length > 120 ? loc.text.slice(0, 120) + " \u2026" : loc.text;
      console.log(`    ${displayText}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
