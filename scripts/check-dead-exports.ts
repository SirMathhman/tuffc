/**
 * Detects exported symbols (including class methods) that are only referenced
 * in test files. Such exports are dead production code.
 */
import { Project, SourceFile, Node, ClassDeclaration } from "ts-morph";
import * as path from "path";

const project = new Project({ tsConfigFilePath: "tsconfig.eslint.json" });

const srcFiles = project
  .getSourceFiles()
  .filter(
    (f) =>
      f.getFilePath().includes("/src/") || f.getFilePath().includes("\\src\\"),
  );

function isTestFile(file: SourceFile): boolean {
  return (
    file.getFilePath().includes("/tests/") ||
    file.getFilePath().includes("\\tests\\")
  );
}

function checkNode(
  label: string,
  declFile: string,
  node: Node,
  definingFile: SourceFile,
): boolean {
  if (!Node.isReferenceFindable(node)) return false;

  const externalRefs = node
    .findReferences()
    .flatMap((r) => r.getReferences())
    .filter(
      (ref) => ref.getSourceFile().getFilePath() !== definingFile.getFilePath(),
    );

  const srcUsages = externalRefs.filter(
    (ref) => !isTestFile(ref.getSourceFile()),
  );
  const testUsages = externalRefs.filter((ref) =>
    isTestFile(ref.getSourceFile()),
  );

  if (testUsages.length > 0 && srcUsages.length === 0) {
    const pos = node.getStartLineNumber();
    console.error(
      `Dead export: '${label}' in ${declFile}:${pos} — only referenced in tests`,
    );
    return true;
  }
  return false;
}

let hasErrors = false;

for (const srcFile of srcFiles) {
  const declFile = path.relative(process.cwd(), srcFile.getFilePath());

  for (const [name, declarations] of srcFile.getExportedDeclarations()) {
    for (const decl of declarations) {
      if (checkNode(name, declFile, decl, srcFile)) hasErrors = true;

      if (Node.isClassDeclaration(decl)) {
        for (const method of (decl as ClassDeclaration).getMethods()) {
          const label = `${name}.${method.getName()}`;
          if (checkNode(label, declFile, method, srcFile)) hasErrors = true;
        }
      }
    }
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log("No dead exports found.");
}
