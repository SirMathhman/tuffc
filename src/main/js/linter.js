import { TuffError } from "./errors.js";

function walkNode(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);

  if (Array.isArray(node)) {
    for (const item of node) walkNode(item, visit);
    return;
  }

  for (const value of Object.values(node)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) walkNode(item, visit);
      continue;
    }
    if (typeof value === "object") {
      walkNode(value, visit);
    }
  }
}

export function lintProgram(ast, options = {}) {
  const enabled = options.enabled ?? false;
  if (!enabled) return [];

  const issues = [];
  const declaredLets = new Map();
  const identifierReads = new Set();

  walkNode(ast, (node) => {
    if (node.kind === "LetDecl") {
      declaredLets.set(node.name, node.loc ?? null);
    }

    if (node.kind === "Identifier") {
      identifierReads.add(node.name);
    }

    if (node.kind === "Block" && node.statements?.length === 0) {
      issues.push(
        new TuffError("Empty block has no effect", node.loc ?? null, {
          code: "E_LINT_EMPTY_BLOCK",
          reason:
            "An empty block executes no statements, which is often accidental and can hide incomplete logic.",
          fix: "Add the intended statements to the block, or remove the block if it is unnecessary.",
        }),
      );
    }

    if (
      (node.kind === "IfStmt" || node.kind === "IfExpr") &&
      node.condition?.kind === "BoolLiteral"
    ) {
      issues.push(
        new TuffError(
          "Constant condition in if-expression/statement",
          node.condition.loc ?? node.loc ?? null,
          {
            code: "E_LINT_CONSTANT_CONDITION",
            reason:
              "A constant condition means one branch is unreachable, which usually indicates dead or unintended code.",
            fix: "Use a non-constant condition, or simplify by keeping only the branch that will execute.",
          },
        ),
      );
    }
  });

  for (const [name, loc] of declaredLets.entries()) {
    if (name.startsWith("_")) continue;
    if (!identifierReads.has(name)) {
      issues.push(
        new TuffError(`Unused binding '${name}'`, loc, {
          code: "E_LINT_UNUSED_BINDING",
          reason:
            "Unused bindings increase cognitive load and can indicate leftover or incomplete code paths.",
          fix: "Remove the binding if unused, use it intentionally, or rename it to start with '_' to mark it as intentionally unused.",
        }),
      );
    }
  }

  return issues;
}
