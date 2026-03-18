export interface Occurrence {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  nodeCount: number;
  kindName: string;
  snippet?: string;
}

export interface CloneClass {
  id: number;
  hash: string;
  nodeCount: number;
  occurrences: Occurrence[];
}

/**
 * Remove clone classes where every occurrence is fully contained (same file,
 * line range subsumed) within an occurrence belonging to a *larger* clone class.
 *
 * This prevents flood-reporting every sub-expression of a duplicated function
 * body when the function body itself is already surfaced as a clone class.
 */
export function suppressNested(classes: CloneClass[]): CloneClass[] {
  // Sort descending by nodeCount so we process larger classes first
  const sorted = [...classes].sort((a, b) => b.nodeCount - a.nodeCount);

  const kept: CloneClass[] = [];

  for (const cls of sorted) {
    const suppressed = kept.some((larger) => {
      // If every occurrence of `cls` is nested inside some occurrence of `larger`
      return cls.occurrences.every((occ) =>
        larger.occurrences.some(
          (l) =>
            l.filePath === occ.filePath &&
            l.lineStart <= occ.lineStart &&
            l.lineEnd >= occ.lineEnd,
        ),
      );
    });

    if (!suppressed) kept.push(cls);
  }

  return kept;
}

/** Render a human-readable text report to a string. */
export function formatText(classes: CloneClass[]): string {
  if (classes.length === 0) {
    return "No duplicate AST subtrees found.\n";
  }

  const lines: string[] = [
    `Found ${classes.length} duplicate clone class(es).\n`,
    "─".repeat(72),
  ];

  for (const cls of classes) {
    lines.push(
      `Clone #${cls.id} — hash ${cls.hash}  nodes: ${cls.nodeCount}  occurrences: ${cls.occurrences.length}`,
    );
    for (const occ of cls.occurrences) {
      lines.push(
        `  ${occ.filePath}:${occ.lineStart}-${occ.lineEnd}  [${occ.kindName}]`,
      );
      if (occ.snippet) {
        for (const line of occ.snippet.split("\n")) {
          lines.push(`    ${line}`);
        }
      }
    }
    lines.push("─".repeat(72));
  }

  return lines.join("\n");
}

/** Render a machine-readable JSON report. */
export function formatJson(classes: CloneClass[]): string {
  return JSON.stringify({ cloneClasses: classes }, null, 2);
}
