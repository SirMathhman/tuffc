import { Project, SyntaxKind, Node } from "ts-morph";

const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();

let failed = false;

for (const sourceFile of sourceFiles) {
  // Check all variable declarations anywhere in the file
  const varDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration,
  );
  for (const decl of varDecls) {
    const name = decl.getNameNode();
    if (!Node.isIdentifier(name)) continue;

    const refs = name.findReferences();
    const usages = refs
      .flatMap((r) => r.getReferences())
      .filter((r) => !r.isDefinition());

    if (usages.length === 1) {
      const { line } = sourceFile.getLineAndColumnAtPos(name.getStart());
      console.error(
        `${sourceFile.getFilePath()}:${line} - "${name.getText()}" is only used once. Inline it.`,
      );
      failed = true;
    }
  }

  // Check all function declarations anywhere in the file
  const funcDecls = sourceFile.getDescendantsOfKind(
    SyntaxKind.FunctionDeclaration,
  );
  for (const decl of funcDecls) {
    const name = decl.getNameNode();
    if (!name) continue;

    const refs = name.findReferences();
    const usages = refs
      .flatMap((r) => r.getReferences())
      .filter((r) => !r.isDefinition());

    if (usages.length === 1) {
      const { line } = sourceFile.getLineAndColumnAtPos(name.getStart());
      console.error(
        `${sourceFile.getFilePath()}:${line} - "${name.getText()}" is only used once. Inline it.`,
      );
      failed = true;
    }
  }
}

process.exit(failed ? 1 : 0);
