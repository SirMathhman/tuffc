import { Project, Node, SyntaxKind, SourceFile } from "ts-morph";

function parseCliArgs(): {
  minNodes: number;
  ignoreIdentifiers: boolean;
  ignoreLiterals: boolean;
} {
  let minNodes = 10;
  let ignoreIdentifiers = false;
  let ignoreLiterals = false;

  let i = 2; // Skip node and script path
  while (i < process.argv.length) {
    const arg = process.argv[i];
    if (arg === "--min-nodes" && i + 1 < process.argv.length) {
      minNodes = parseInt(process.argv[i + 1], 10);
      i += 2;
    } else if (arg === "--ignore-identifiers" && i + 1 < process.argv.length) {
      ignoreIdentifiers = process.argv[i + 1] !== "false";
      i += 2;
    } else if (arg === "--ignore-literals" && i + 1 < process.argv.length) {
      ignoreLiterals = process.argv[i + 1] !== "false";
      i += 2;
    } else {
      i++;
    }
  }

  return { minNodes, ignoreIdentifiers, ignoreLiterals };
}

const config = parseCliArgs();
const MIN_NODES = config.minNodes;
const IGNORE_IDENTIFIERS = config.ignoreIdentifiers;
const IGNORE_LITERALS = config.ignoreLiterals;

function isLiteralKind(kind: SyntaxKind): boolean {
  return (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NumericLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral ||
    kind === SyntaxKind.TrueKeyword ||
    kind === SyntaxKind.FalseKeyword ||
    kind === SyntaxKind.NullKeyword
  );
}

function isIgnoredKind(kind: SyntaxKind): boolean {
  if (IGNORE_IDENTIFIERS && kind === SyntaxKind.Identifier) {
    return true;
  }
  if (IGNORE_LITERALS && isLiteralKind(kind)) {
    return true;
  }
  return false;
}

function isIdentifierKind(kind: SyntaxKind): boolean {
  return kind === SyntaxKind.Identifier;
}

function computeStructuralHash(node: Node): string {
  const kind = node.getKind();
  if (isIgnoredKind(kind)) {
    return `(${kind})`;
  }
  if (!IGNORE_IDENTIFIERS && isIdentifierKind(kind)) {
    return `(${kind}:${node.getText()})`;
  }
  if (!IGNORE_LITERALS && isLiteralKind(kind)) {
    return `(${kind}:${node.getText()})`;
  }
  const childHashes: string[] = [];
  node.forEachChild((child) => {
    childHashes.push(computeStructuralHash(child));
  });
  if (childHashes.length === 0) {
    return `(${kind})`;
  }
  return `(${kind} ${childHashes.join(" ")})`;
}

function countNodes(node: Node): number {
  let count = 1;
  node.forEachChild((child) => {
    count += countNodes(child);
  });
  return count;
}

interface NodeLocation {
  file: string;
  line: number;
  text: string;
  nodeCount: number;
}

function collectSubtrees(
  node: Node,
  filePath: string,
  map: Map<string, NodeLocation[]>,
): void {
  const nodeCount = countNodes(node);
  if (nodeCount >= MIN_NODES && !isIgnoredKind(node.getKind())) {
    const hash = computeStructuralHash(node);
    let entries = map.get(hash);
    if (entries === undefined) {
      entries = [];
      map.set(hash, entries);
    }
    entries.push({
      file: filePath,
      line: node.getStartLineNumber(),
      text: node.getText(),
      nodeCount,
    });
  }
  node.forEachChild((child) => {
    collectSubtrees(child, filePath, map);
  });
}

function processFile(sf: SourceFile, map: Map<string, NodeLocation[]>): void {
  const filePath = sf.getFilePath();
  collectSubtrees(sf, filePath, map);
}

function processLocations(
  locations: NodeLocation[],
  reported: Set<string>,
): NodeLocation[] | null {
  if (locations.length < 2) return null;

  const uniqueLocations: NodeLocation[] = [];
  const seen = new Set<string>();
  let li = 0;
  while (li < locations.length) {
    const key = `${locations[li].file}:${locations[li].line}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLocations.push(locations[li]);
    }
    li++;
  }
  if (uniqueLocations.length < 2) return null;

  const sortedKeys = uniqueLocations
    .map((loc) => `${loc.file}:${loc.line}`)
    .sort()
    .join("|");
  if (reported.has(sortedKeys)) return null;
  reported.add(sortedKeys);
  return uniqueLocations;
}

function reportDuplicate(uniqueLocations: NodeLocation[]): void {
  const nodeCount = uniqueLocations[0].nodeCount;
  console.error(
    `\nAST duplicate detected (${nodeCount} nodes, ${uniqueLocations.length} occurrences):`,
  );
  let ui = 0;
  while (ui < uniqueLocations.length) {
    const loc = uniqueLocations[ui];
    console.error(`  ${loc.file}:${loc.line}`);
    const indented = loc.text
      .split("\n")
      .map((l) => "    " + l)
      .join("\n");
    console.error(indented);
    ui++;
  }
}

function main(): void {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const sourceFiles = project.getSourceFiles();
  const map = new Map<string, NodeLocation[]>();

  let fi = 0;
  while (fi < sourceFiles.length) {
    processFile(sourceFiles[fi], map);
    fi++;
  }

  let foundDuplicates = false;
  const reported = new Set<string>();

  map.forEach((locations) => {
    const unique = processLocations(locations, reported);
    if (unique === null) return;
    foundDuplicates = true;
    reportDuplicate(unique);
  });

  if (foundDuplicates) {
    console.error(
      `\nAST duplication check failed (min nodes: ${MIN_NODES}). Refactor duplicated code.`,
    );
    process.exit(1);
  }
}

main();
