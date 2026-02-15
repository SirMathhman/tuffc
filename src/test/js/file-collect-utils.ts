import fs from "node:fs";
import path from "node:path";

export function collectFilesByExtension(
  dir: string,
  extension: string,
): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  const normalizedExt = extension.toLowerCase();
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesByExtension(full, normalizedExt));
      continue;
    }
    if (entry.isFile() && full.toLowerCase().endsWith(normalizedExt)) {
      files.push(full);
    }
  }
  return files;
}
