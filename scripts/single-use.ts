import { Project, SyntaxKind, Node, VariableDeclaration } from "ts-morph";
const project = new Project({ useInMemoryFileSystem: false });
project.addSourceFilesAtPaths(["**/*.ts", "!node_modules/**", "!.github/**"]);

const sourceFiles = project.getSourceFiles();

let failed = false;

// Helper to safely get initializer
function getInitializer(node: Node): Node | undefined {
  if (node instanceof VariableDeclaration) {
    return node.getInitializer();
  }
  return undefined;
}

// Check if a character is a valid identifier character
function isValidIdentifierChar(char: string): boolean {
  return (
    char === "_" ||
    char === "$" ||
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    (char >= "0" && char <= "9")
  );
}

// Check if a string is a valid identifier
function isValidIdentifier(text: string): boolean {
  if (text.length === 0) return false;
  const firstChar = text.charAt(0);
  if (
    firstChar === "_" ||
    firstChar === "$" ||
    (firstChar >= "a" && firstChar <= "z") ||
    (firstChar >= "A" && firstChar <= "Z")
  ) {
    return Array.from(text).every((char) => isValidIdentifierChar(char));
  }
  return false;
}

// Only flag the most egregious single-use cases:
// - simple identity/wrapper assignments (const x = y; return x; or use(x);)
// - helper functions that are called exactly once
const isEgregiousWrapper = (decl: Node): boolean => {
  const initializer = getInitializer(decl);
  if (!initializer) return false;

  const text = initializer.getText();
  // Flag only if it's a simple identifier reference (wrapping, not transformation)
  const isSimpleIdentifier =
    isValidIdentifier(text) && !text.includes("(") && !text.includes(".");
  if (isSimpleIdentifier) {
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

  // Check all function declarations - flag if used once, unless the sole
  // usage is as a higher-order callback (passed by reference as an argument).
  // Callbacks extracted to the top level to satisfy ban-inner-functions must
  // not be penalised here.
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
      const refNode = usages[0].getNode();
      const parent = refNode.getParent();
      // exempt: the function is passed as a callback argument (not as the
      // callee of a direct call expression)
      if (
        parent &&
        parent.getKind() === SyntaxKind.CallExpression &&
        parent.asKindOrThrow(SyntaxKind.CallExpression).getExpression() ===
          refNode
      ) {
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
