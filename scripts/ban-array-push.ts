import { Node, Project, PropertyAccessExpression, SyntaxKind } from "ts-morph";
import * as path from "path";

const project = new Project({ tsConfigFilePath: "tsconfig.eslint.json" });

function isArrayLikeTarget(node: PropertyAccessExpression): boolean {
  const targetTypeText = node.getExpression().getType().getText(node);
  return (
    targetTypeText.endsWith("[]") ||
    targetTypeText.includes("Array<") ||
    targetTypeText.startsWith("[")
  );
}

const violations = project.getSourceFiles().flatMap((sourceFile) =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((callExpression) => {
      const expression = callExpression.getExpression();
      if (!Node.isPropertyAccessExpression(expression)) {
        return [];
      }

      if (expression.getName() !== "push") {
        return [];
      }

      if (!isArrayLikeTarget(expression)) {
        return [];
      }

      return [
        {
          filePath: sourceFile.getFilePath(),
          line: callExpression.getStartLineNumber(),
          text: callExpression.getText(),
        },
      ];
    }),
);

if (violations.length > 0) {
  for (const violation of violations) {
    const relativePath = path.relative(process.cwd(), violation.filePath);
    console.error(
      "Mutable array operation banned: " +
        relativePath +
        ":" +
        violation.line +
        " uses Array.push -> " +
        violation.text,
    );
  }
  process.exit(1);
}

console.log("No banned Array.push usages found.");
