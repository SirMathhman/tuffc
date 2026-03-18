import ts from "typescript";

export interface CanonicalizeOptions {
  /**
   * Replace every user-defined identifier with a per-subtree canonical ordinal
   * ($0, $1, …) based on first occurrence. Detects Type-2 (alpha-renamed) clones.
   * Default: true
   */
  normalizeIdentifiers: boolean;

  /**
   * Replace string and numeric literal values with a generic placeholder.
   * Detects clones that differ only in literal values.
   * Default: false
   */
  normalizeLiterals: boolean;

  /**
   * Include TypeScript type annotation nodes in the canonical form. When false
   * the same logic with different type annotations still counts as a clone.
   * Default: true
   */
  keepTypeAnnotations: boolean;
}

export const DEFAULT_OPTIONS: CanonicalizeOptions = {
  normalizeIdentifiers: true,
  normalizeLiterals: false,
  keepTypeAnnotations: true,
};

/**
 * Produce a canonical string representation of an AST subtree.
 *
 * - Strips all position/trivia information.
 * - Optionally normalises identifier names using a *per-subtree* mapping so
 *   that alpha-equivalent code (same structure, different variable names) yields
 *   the same canonical form.
 * - Optionally normalises literal values.
 * - Optionally strips type annotation nodes.
 */
export function canonicalize(
  node: ts.Node,
  options: CanonicalizeOptions = DEFAULT_OPTIONS,
): string {
  const identMap = new Map<string, string>();
  let identCounter = 0;

  function getCanonicalId(name: string): string {
    if (!identMap.has(name)) {
      identMap.set(name, "$" + identCounter++);
    }
    return identMap.get(name)!;
  }

  function serialize(n: ts.Node): string {
    // ── Keyword literals (true / false / null / this / super / undefined) ──
    // These are their own SyntaxKind values, NOT Identifier nodes, so they
    // pass through unchanged and do not get normalised.

    // ── Identifiers ──
    if (ts.isIdentifier(n)) {
      const text = n.text;
      // Property names (keys) are structural, not bindings — preserve them
      // even when normalizeIdentifiers is on. Otherwise `{ foo: x }` and
      // `{ bar: x }` would canonicalize identically, producing false clones.
      const isPropertyName =
        n.parent &&
        (ts.isPropertyAssignment(n.parent) ||
          ts.isShorthandPropertyAssignment(n.parent) ||
          ts.isMethodDeclaration(n.parent) ||
          ts.isGetAccessorDeclaration(n.parent) ||
          ts.isSetAccessorDeclaration(n.parent)) &&
        n.parent.name === n;
      if (options.normalizeIdentifiers && !isPropertyName) {
        return "(Id:" + getCanonicalId(text) + ")";
      }
      return "(Id:" + text + ")";
    }

    // ── Literals ──
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      return options.normalizeLiterals
        ? "(StrLit:$)"
        : "(StrLit:" + JSON.stringify(n.text) + ")";
    }
    if (ts.isNumericLiteral(n)) {
      return options.normalizeLiterals
        ? "(NumLit:$)"
        : "(NumLit:" + n.text + ")";
    }
    if (ts.isBigIntLiteral(n)) {
      return options.normalizeLiterals
        ? "(BigIntLit:$)"
        : "(BigIntLit:" + n.text + ")" + ")";
    }

    // ── Type annotation nodes ──
    if (
      !options.keepTypeAnnotations &&
      n.kind >= ts.SyntaxKind.FirstTypeNode &&
      n.kind <= ts.SyntaxKind.LastTypeNode
    ) {
      return "";
    }

    // ── Generic node: kind + serialised children ──
    const kindName = ts.SyntaxKind[n.kind];
    const parts: string[] = [];

    ts.forEachChild(n, (child) => {
      const s = serialize(child);
      if (s !== "") parts.push(s);
    });

    return "(" + kindName + ":" + parts.join(",") + ")";
  }

  return serialize(node);
}
