/** Shared Tuff-source snippet utilities used by tests and verification scripts. */

export function hasExplicitMain(source: string): boolean {
  return /\bfn\s+main\s*\(/.test(source);
}

export function wrapSnippetAsMain(source: string): string {
  return `fn main() => {\n${source}\n}`;
}
