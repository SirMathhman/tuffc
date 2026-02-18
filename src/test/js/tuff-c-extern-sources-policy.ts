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

for (const name of files) {
  const filePath = path.join(tuffCDir, name);
  const source = fs.readFileSync(filePath, "utf8");

  const matches = source.matchAll(/extern\s+let\s+\{[^}]*\}\s*=\s*([^;\n]+);/g);
  for (const match of matches) {
    const bucket = String(match[1]).trim();
    if (!allowedSources.has(bucket)) {
      console.error(
        `Forbidden extern source bucket '${bucket}' in ${name}. Only C stdlib/source aliases are allowed.`,
      );
      process.exit(1);
    }
  }
}

console.log("tuff-c extern source policy checks passed");
