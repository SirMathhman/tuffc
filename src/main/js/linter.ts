// @ts-nocheck
import { TuffError } from "./errors.ts";
import { lex } from "./lexer.ts";

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

function collectReceiverExternFns(ast) {
  const receiverExternFns = new Set();
  for (const node of ast.body ?? []) {
    if (
      node?.kind === "ExternFnDecl" &&
      Array.isArray(node.params) &&
      node.params.length > 0 &&
      node.params[0]?.name === "this"
    ) {
      receiverExternFns.add(node.name);
    }
  }
  return receiverExternFns;
}

export function autoFixProgram(
  ast: { body?: unknown[] },
  options: Record<string, unknown> = {},
): { applied: number; fixedSource: string | undefined } {
  const enabled = options.enabled ?? false;
  const fix = options.fix ?? false;
  const source = options.source ?? undefined;
  if (!enabled || !fix) return { applied: 0, fixedSource: source };

  const receiverExternFns = collectReceiverExternFns(ast);
  let applied = 0;
  const edits = [];

  walkNode(ast, (node) => {
    if (
      node?.kind === "CallExpr" &&
      node.callee?.kind === "Identifier" &&
      receiverExternFns.has(node.callee.name) &&
      (node.callStyle ?? "") !== "method-sugar" &&
      Array.isArray(node.args) &&
      node.args.length > 0 &&
      typeof node.start === "number" &&
      typeof node.end === "number"
    ) {
      node.callStyle = "method-sugar";
      applied += 1;

      if (source) {
        const firstArg = node.args[0];
        if (
          firstArg &&
          typeof firstArg.start === "number" &&
          typeof firstArg.end === "number"
        ) {
          const receiverText = source.slice(firstArg.start, firstArg.end);
          const restArgs = [];
          for (let i = 1; i < node.args.length; i += 1) {
            const arg = node.args[i];
            if (
              !arg ||
              typeof arg.start !== "number" ||
              typeof arg.end !== "number"
            ) {
              return;
            }
            restArgs.push(source.slice(arg.start, arg.end));
          }
          const replacement = `${receiverText}.${node.callee.name}(${restArgs.join(", ")})`;
          edits.push({ start: node.start, end: node.end, replacement });
        }
      }
    }
  });

  let fixedSource = source;
  if (source && edits.length > 0) {
    edits.sort((a, b) => b.start - a.start);
    const merged = [];
    let lastStart = Infinity;
    for (const edit of edits) {
      if (edit.end <= lastStart) {
        merged.push(edit);
        lastStart = edit.start;
      }
    }
    for (const edit of merged) {
      fixedSource =
        fixedSource.slice(0, edit.start) +
        edit.replacement +
        fixedSource.slice(edit.end);
    }
  }

  return { applied, fixedSource };
}

export function lintProgram(
  ast: { body?: unknown[] },
  options: Record<string, unknown> = {},
): unknown[] {
  const enabled = options.enabled ?? false;
  if (!enabled) return [];

  const issues = [];
  const maxEffectiveLines = options.maxEffectiveLines ?? 500;

  function pushFileLengthIssue(filePath, source) {
    if (typeof source !== "string") return;
    const tokensResult = lex(source, filePath);
    if (!tokensResult.ok) {
      issues.push(tokensResult.error);
      return;
    }
    const tokens = tokensResult.value;
    const effectiveLines = new Set();
    for (const token of tokens) {
      if (token.type === "eof") continue;
      if (token?.loc?.line != undefined) {
        effectiveLines.add(token.loc.line);
      }
    }
    const count = effectiveLines.size;
    if (count > maxEffectiveLines) {
      issues.push(
        new TuffError(
          `File exceeds ${maxEffectiveLines} effective lines (${count})`,
          { filePath, line: 1, column: 1 },
          {
            code: "E_LINT_FILE_TOO_LONG",
            reason:
              "Large files are harder to review and maintain; this file exceeds the maximum effective line budget after excluding comments and blank lines.",
            fix: `Split this file into smaller modules so each file has at most ${maxEffectiveLines} non-comment, non-whitespace lines.`,
          },
        ),
      );
    }
  }

  if (options.sourceByFile instanceof Map) {
    const entries = [...options.sourceByFile.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [filePath, source] of entries) {
      pushFileLengthIssue(filePath, source);
    }
  } else if (typeof options.source === "string") {
    pushFileLengthIssue(options.filePath ?? "<memory>", options.source);
  }

  if (Array.isArray(options.moduleImportCycles)) {
    for (const cycle of options.moduleImportCycles) {
      if (!Array.isArray(cycle) || cycle.length < 2) continue;
      const firstFilePath = cycle[0] ?? "<module>";
      issues.push(
        new TuffError(
          `Circular import detected: ${cycle.join(" -> ")}`,
          { filePath: firstFilePath, line: 1, column: 1 },
          {
            code: "E_LINT_CIRCULAR_IMPORT",
            reason:
              "Circular dependencies between modules make dependency flow harder to understand and maintain.",
            fix: "Refactor shared declarations into a third module and have each side import that shared module instead.",
          },
        ),
      );
    }
  }

  const declaredLets = new Map();
  const identifierReads = new Set();
  const receiverExternFns = collectReceiverExternFns(ast);

  walkNode(ast, (node) => {
    if (node.kind === "LetDecl") {
      declaredLets.set(node.name, node.loc ?? undefined);
    }

    if (node.kind === "Identifier") {
      identifierReads.add(node.name);
    }

    if (
      node.kind === "CallExpr" &&
      node.callee?.kind === "Identifier" &&
      receiverExternFns.has(node.callee.name) &&
      (node.callStyle ?? "") !== "method-sugar" &&
      Array.isArray(node.args) &&
      node.args.length > 0
    ) {
      issues.push(
        new TuffError(
          `Prefer receiver-call syntax for '${node.callee.name}'`,
          node.loc ?? undefined,
          {
            code: "E_LINT_PREFER_RECEIVER_CALL",
            reason:
              "This extern function declares a receiver as its first 'this' parameter, so calling it as a free function is less idiomatic.",
            fix: `Rewrite '${node.callee.name}(x, ...)' as 'x.${node.callee.name}(...)'.`,
          },
        ),
      );
    }

    if (node.kind === "Block" && node.statements?.length === 0) {
      issues.push(
        new TuffError("Empty block has no effect", node.loc ?? undefined, {
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
          node.condition.loc ?? node.loc ?? undefined,
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
