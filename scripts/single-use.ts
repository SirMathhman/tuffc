import { Project, SyntaxKind, Node } from "ts-morph";

const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();

let failed = false;

// Only flag the most egregious single-use cases:
// - simple identity/wrapper assignments (const x = y; return x; or use(x);)
// - helper functions that are called exactly once
const isEgregiousWrapper = (decl: any): boolean => {
  const initializer = decl.getInitializer();
  if (!initializer) return false;

  const text = initializer.getText();
  // Flag only if it's a simple identifier reference (wrapping, not transformation)
  if (
    text.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) &&
    !text.includes("(") &&
    !text.includes(".")
  ) {
    return true;
  }

  // Flag simple ternary returns: x ? a : b
  if (text.includes("?") && text.includes(":")) {
    return true;
  }

  return false;
};

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();
  // Skip checking the single-use script itself and test files
  if (filePath.includes("single-use.ts") || filePath.includes(".test.ts")) {
    continue;
  }

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

    // Only flag wrapper variables
    if (usages.length === 1 && isEgregiousWrapper(decl)) {
      const { line } = sourceFile.getLineAndColumnAtPos(name.getStart());
      console.error(
        `${sourceFile.getFilePath()}:${line} - "${name.getText()}" is only used once. Inline it.`,
      );
      failed = true;
    }
  }

  // Check all function declarations - always flag  if used once
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
