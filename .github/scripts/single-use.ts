import { Project, SyntaxKind, Node } from "ts-morph";

const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();

let failed = false;

for (const sourceFile of sourceFiles) {
  // Collect all top-level variable declarations (const x = ...) and function declarations
  const statements = sourceFile.getStatements();

  for (const statement of statements) {
    // Handle: const x = ...
    if (statement.isKind(SyntaxKind.VariableStatement)) {
      for (const decl of statement.getDeclarationList().getDeclarations()) {
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
    }

    // Handle: function foo() {} (in case any slips through)
    if (statement.isKind(SyntaxKind.FunctionDeclaration)) {
      const name = statement.getNameNode();
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
}

process.exit(failed ? 1 : 0);
