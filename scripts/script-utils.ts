/**
 * Shared boilerplate for scripts/ — re-exported standard modules + resolved
 * workspace root, so individual scripts don't need the same 7-line header.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export { fs, path, spawnSync };

/** Absolute path to the Tuffc/ workspace root. */
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
