import path from "node:path";
import { fileURLToPath } from "node:url";

export function getRepoRootFromImportMeta(importMetaUrl: string): string {
  const thisFile = fileURLToPath(importMetaUrl);
  return path.resolve(path.dirname(thisFile), "..", "..", "..");
}

export function getTsxCliPath(root: string): string {
  return path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
}

export function getNodeExecPath(): string {
  // Bun can execute this harness, but tsx child scripts are most stable when
  // launched under Node directly.
  const exec = process.execPath.toLowerCase();
  if (exec.includes("node")) {
    return process.execPath;
  }
  return "node";
}

export function getTestsOutDir(root: string, ...parts: string[]): string {
  return path.join(root, "tests", "out", ...parts);
}

export function getSrcDir(root: string): string {
  return path.join(root, "src");
}
