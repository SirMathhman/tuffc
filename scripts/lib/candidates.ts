import ts from "typescript";

export interface CandidateNode {
  node: ts.Node;
  sourceFile: ts.SourceFile;
  filePath: string;
  /** Number of AST nodes in the subtree (inclusive). */
  nodeCount: number;
  /** 1-based start line. */
  lineStart: number;
  /** 1-based end line. */
  lineEnd: number;
  /** Human-readable kind name for reporting. */
  kindName: string;
}

/** Recursively count all nodes in the subtree. */
export function countNodes(node: ts.Node): number {
  let count = 1;
  ts.forEachChild(node, (child) => {
    count += countNodes(child);
  });
  return count;
}

/**
 * Walk a SourceFile and collect every subtree whose node count is at or above
 * `minNodeCount` and whose line span is at or above `minLines`.
 *
 * The SourceFile root is excluded because it always encompasses the whole file
 * and would produce a trivial match for any two identical files rather than
 * surfacing the duplicated sub-fragments.
 */
export function collectCandidates(
  sourceFile: ts.SourceFile,
  filePath: string,
  minNodeCount: number,
  minLines: number,
): CandidateNode[] {
  const candidates: CandidateNode[] = [];

  // These node kinds are skipped as top-level clone candidates because their
  // LHS binding name is noise: `const x = <expr>` and `const y = <expr>` would
  // match purely on the RHS, which is better surfaced by the RHS node itself.
  const SKIP_KINDS = new Set([
    ts.SyntaxKind.VariableStatement,
    ts.SyntaxKind.VariableDeclarationList,
    ts.SyntaxKind.VariableDeclaration,
  ]);

  function isLowValueBlock(node: ts.Node): boolean {
    return ts.isBlock(node) && node.statements.length <= 1;
  }

  function visit(node: ts.Node): void {
    // Skip the synthetic EndOfFileToken
    if (node.kind === ts.SyntaxKind.EndOfFileToken) return;

    // Skip variable declaration nodes — their LHS binding name is noise;
    // the RHS expression is still visited and can be a candidate on its own.
    const skipAsCandidate = SKIP_KINDS.has(node.kind) || isLowValueBlock(node);

    const nodeCount = countNodes(node);

    if (!skipAsCandidate && nodeCount >= minNodeCount) {
      // getStart trims leading trivia; getEnd is raw
      const startPos = node.getStart(sourceFile, /*includeJsDocComment*/ false);
      const endPos = node.getEnd();
      const { line: lineStartZero } =
        sourceFile.getLineAndCharacterOfPosition(startPos);
      const { line: lineEndZero } =
        sourceFile.getLineAndCharacterOfPosition(endPos);

      const lineSpan = lineEndZero - lineStartZero + 1;

      if (lineSpan >= minLines) {
        candidates.push({
          node,
          sourceFile,
          filePath,
          nodeCount,
          lineStart: lineStartZero + 1,
          lineEnd: lineEndZero + 1,
          kindName: ts.SyntaxKind[node.kind],
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return candidates;
}
