/**
 * Common utilities shared across migration and analysis scripts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get the project root directory
export function getProjectRoot(importMetaUrl: string): string {
  const thisFile = fileURLToPath(importMetaUrl);
  return path.resolve(path.dirname(thisFile), "..");
}

// Standard candidate root directories for Tuff source scanning
export function getCandidateRoots(root: string): string[] {
  return [
    path.join(root, "src", "main", "tuff"),
    path.join(root, "src", "main", "tuff-core"),
    path.join(root, "src", "main", "tuff-js"),
    path.join(root, "src", "main", "tuff-c"),
    path.join(root, "src", "test", "tuff"),
  ];
}

// Selfhost CPD bridge interface
export type SelfhostCpdBridge = {
  cpd_lex_init(source: string): number;
  cpd_lex_all(): number;
  cpd_tok_kind(idx: number): number;
  cpd_tok_value(idx: number): number;
  cpd_tok_line(idx: number): number;
  cpd_tok_col(idx: number): number;
  cpd_get_interned_str?(idx: number): string;
};
