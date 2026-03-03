import { Project, SyntaxKind } from "ts-morph";

const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();

let failed = false;

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();
  if (
    filePath.includes("scripts/") ||
    filePath.includes("scripts\\") ||
    filePath.includes(".test.ts")
  ) {
    continue;
  }

  // Find all function declarations that are nested inside another function
  const funcDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const decl of funcDecls) {
    const isNested = decl
      .getAncestors()
      .some(
        (a) =>
          a.getKind() === SyntaxKind.FunctionDeclaration ||
          a.getKind() === SyntaxKind.FunctionExpression ||
          a.getKind() === SyntaxKind.ArrowFunction ||
          a.getKind() === SyntaxKind.MethodDeclaration,
      );
    if (isNested) {
      const name = decl.getNameNode();
      const { line } = sourceFile.getLineAndColumnAtPos(decl.getStart());
      console.error(
        `${filePath}:${line} - Inner function ${name ? `"${name.getText()}"` : "(anonymous)"} is not allowed. Move it to the top level or inline it.`,
      );
      failed = true;
    }
  }

  // Flag arrow functions and function expressions assigned to variables
  // that are themselves declared inside another function.
  // Exception: concise (non-block-body) arrow functions are allowed because
  // they are practical for map/filter/reduce callbacks, e.g. (x) => x + 1.
  const varDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration,
  );
  for (const decl of varDecls) {
    const initializer = decl.getInitializer();
    if (!initializer) continue;
    const kind = initializer.getKind();
    if (
      kind !== SyntaxKind.ArrowFunction &&
      kind !== SyntaxKind.FunctionExpression
    ) {
      continue;
    }
    // Allow concise arrow functions (no block body): () => expr
    if (kind === SyntaxKind.ArrowFunction) {
      const body = initializer
        .asKindOrThrow(SyntaxKind.ArrowFunction)
        .getBody();
      if (body.getKind() !== SyntaxKind.Block) continue;
    }
    const isNested = decl
      .getAncestors()
      .some(
        (a) =>
          a.getKind() === SyntaxKind.FunctionDeclaration ||
          a.getKind() === SyntaxKind.FunctionExpression ||
          a.getKind() === SyntaxKind.ArrowFunction ||
          a.getKind() === SyntaxKind.MethodDeclaration,
      );
    if (isNested) {
      const nameNode = decl.getNameNode();
      const { line } = sourceFile.getLineAndColumnAtPos(decl.getStart());
      console.error(
        `${filePath}:${line} - Inner function "${nameNode.getText()}" is not allowed. Move it to the top level or inline it.`,
      );
      failed = true;
    }
  }

  // Flag anonymous arrow functions with block bodies used inline (not assigned)
  // inside other functions, e.g. arr.map((x) => { return x; })
  const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
  for (const arrow of arrowFuncs) {
    const body = arrow.getBody();
    if (body.getKind() !== SyntaxKind.Block) continue;
    const isNested = arrow
      .getAncestors()
      .some(
        (a) =>
          a.getKind() === SyntaxKind.FunctionDeclaration ||
          a.getKind() === SyntaxKind.FunctionExpression ||
          a.getKind() === SyntaxKind.ArrowFunction ||
          a.getKind() === SyntaxKind.MethodDeclaration,
      );
    if (!isNested) continue;
    // skip if this arrow is the initializer of a variable (already covered above)
    const parent = arrow.getParent();
    if (parent.getKind() === SyntaxKind.VariableDeclaration) continue;
    const { line } = sourceFile.getLineAndColumnAtPos(arrow.getStart());
    console.error(
      `${filePath}:${line} - Block-body arrow function inside a function is not allowed. Use a concise arrow or extract to top level.`,
    );
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
