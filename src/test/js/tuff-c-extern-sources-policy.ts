// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const tuffCDir = path.join(root, "src", "main", "tuff-c");

const allowedSources = new Set([
  "stdio",
  "stdlib",
  "string",
  "stdint",
  "stddef",
  "errno",
  "direct",
  "sys::stat",
  "sys::types",
]);

const files = fs
  .readdirSync(tuffCDir)
  .filter((name) => name.endsWith(".tuff"))
  .sort();

function lineFromOffset(source: string, offset: number): number {
  if (offset <= 0) return 1;
  return source.slice(0, offset).split(/\r?\n/).length;
}

for (const name of files) {
  const filePath = path.join(tuffCDir, name);
  const source = fs.readFileSync(filePath, "utf8");

  const matches = source.matchAll(/extern\s+let\s+\{[^}]*\}\s*=\s*([^;\n]+);/g);
  for (const match of matches) {
    const bucket = String(match[1]).trim();
    if (!allowedSources.has(bucket)) {
      const at =
        typeof match.index === "number"
          ? lineFromOffset(source, match.index)
          : -1;
      const allowed = [...allowedSources].sort().join(", ");
      console.error(
        `Forbidden extern source bucket '${bucket}' in ${name}:${at}. Allowed buckets: ${allowed}.`,
      );
      process.exit(1);
    }
  }
}

console.log("tuff-c extern source policy checks passed");
