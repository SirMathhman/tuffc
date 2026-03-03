import { Project, SyntaxKind, Node } from "ts-morph";

const MAX_OUTER_CAPTURES = 5;

const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();
const sourceFilePaths = new Set(sourceFiles.map((f) => f.getFilePath()));

let failed = false;

const FUNCTION_KINDS = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
]);

function isInsideFunction(node: Node): boolean {
  return node.getAncestors().some((a) => FUNCTION_KINDS.has(a.getKind()));
}

function countOuterCaptures(innerFunc: Node): number {
  const funcStart = innerFunc.getStart();
  const funcEnd = innerFunc.getEnd();
  const outerNames = new Set<string>();

  for (const id of innerFunc.getDescendantsOfKind(SyntaxKind.Identifier)) {
    // Skip identifiers that are themselves a declaration
    const parent = id.getParent();
    if (!parent) continue;
    const pk = parent.getKind();
    if (pk === SyntaxKind.VariableDeclaration) {
      if (
        parent.asKindOrThrow(SyntaxKind.VariableDeclaration).getNameNode() ===
        id
      )
        continue;
    }
    if (pk === SyntaxKind.Parameter) {
      if (parent.asKindOrThrow(SyntaxKind.Parameter).getNameNode() === id)
        continue;
    }
    if (pk === SyntaxKind.FunctionDeclaration) continue;
    if (pk === SyntaxKind.PropertyAssignment) {
      if (
        parent.asKindOrThrow(SyntaxKind.PropertyAssignment).getNameNode() === id
      )
        continue;
    }
    // Skip property access right-hand side (e.g. the `bar` in `foo.bar`)
    if (pk === SyntaxKind.PropertyAccessExpression) {
      if (
        parent
          .asKindOrThrow(SyntaxKind.PropertyAccessExpression)
          .getNameNode() === id
      )
        continue;
    }

    const symbol = id.getSymbol();
    if (!symbol) continue;

    const isOuter = symbol.getDeclarations().some((d) => {
      const dFile = d.getSourceFile().getFilePath();
      if (!sourceFilePaths.has(dFile)) return false; // built-in / lib — ignore
      const dStart = d.getStart();
      return dStart < funcStart || dStart > funcEnd;
    });
    if (isOuter) outerNames.add(id.getText());
  }

  return outerNames.size;
}

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();
  if (
    filePath.includes("scripts/") ||
    filePath.includes("scripts\\") ||
    filePath.includes(".test.ts")
  )
    continue;

  for (const kind of [
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction,
  ]) {
    for (const node of sourceFile.getDescendantsOfKind(kind)) {
      if (!isInsideFunction(node)) continue;
      const captures = countOuterCaptures(node);
      if (captures > MAX_OUTER_CAPTURES) {
        const { line } = sourceFile.getLineAndColumnAtPos(node.getStart());
        console.error(
          `${filePath}:${line} - Inner function captures ${captures} outer names (max ${MAX_OUTER_CAPTURES}). Extract or reduce captured values.`,
        );
        failed = true;
      }
    }
  }
}

process.exit(failed ? 1 : 0);
