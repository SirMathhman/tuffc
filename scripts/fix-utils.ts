#!/usr/bin/env tsx
/**
 * Shared utilities for one-off Tuff source migration scripts.
 */
import * as fs from "fs";
import * as path from "path";

export { fs, path };

export const TUFFC_ROOT = process.cwd();

export const tuffFilePath = path.join(
  process.cwd(),
  "src/main/tuff/selfhost/internal/typecheck_impl.tuff",
);

export interface FunctionRange {
  name: string;
  start: number;
  end: number;
}

/** Find all top-level functions returning `Result<I32, TypeError>`. */
export function findResultFunctions(lines: string[]): FunctionRange[] {
  const resultFunctions: FunctionRange[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^fn\s+(\w+)/)) {
      const match = line.match(/^fn\s+(\w+)/);
      const name = match ? match[1] : "unknown";

      let signatureBlock = line;
      for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
        signatureBlock += lines[k];
        if (lines[k].includes("=>")) break;
      }

      if (signatureBlock.match(/:\s*Result<I32,\s*TypeError>\s*=>/)) {
        const start = i;
        let end = lines.length - 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].match(/^fn\s+\w+/)) {
            end = j - 1;
            break;
          }
        }
        resultFunctions.push({ name, start, end });
      }
    }
  }

  return resultFunctions;
}

/** Returns a predicate that is true when a line is inside any of the given ranges. */
export function makeIsInResultFunction(
  resultFunctions: FunctionRange[],
): (lineNum: number) => boolean {
  return (lineNum) =>
    resultFunctions.some((f) => lineNum >= f.start && lineNum <= f.end);
}

/** Returns the number of lines modified. */
export function addReturnToTcErrorCalls(
  lines: string[],
  isInResultFunction: (lineNum: number) => boolean,
): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isInResultFunction(i)) continue;
    const line = lines[i];
    if (line.match(/^\s+tc_error\(/) && !line.match(/return\s+tc_error/)) {
      lines[i] = line.replace(/(\s+)tc_error/, "$1return tc_error");
      count++;
    }
  }
  return count;
}

/**
 * Load the target Tuff file, back it up with the given suffix, and return
 * `{ lines, isInResultFunction }` ready for the migration steps.
 */
export function loadAndSetupFixTarget(backupSuffix: string): {
  filePath: string;
  lines: string[];
  isInResultFunction: (lineNum: number) => boolean;
} {
  const filePath = tuffFilePath;
  const content = fs.readFileSync(filePath, "utf-8");
  const backupPath = filePath + backupSuffix;
  fs.writeFileSync(backupPath, content, "utf-8");
  console.log(`\u2713 Backed up to ${path.basename(backupPath)}`);

  const lines = content.split("\n");
  const resultFunctions = findResultFunctions(lines);

  console.log(`Found ${resultFunctions.length} Result-returning functions:`);
  resultFunctions.forEach((f) =>
    console.log(`  - ${f.name} (lines ${f.start + 1}-${f.end + 1})`),
  );

  const isInResultFunction = makeIsInResultFunction(resultFunctions);
  return { filePath, lines, isInResultFunction };
}

/**
 * Add `?` to `typecheck_expr/stmt/if_expr_branch(...)` call sites that are
 * inside Result-returning functions and don't already end with `?;`.
 *
 * Returns the number of lines modified.
 */
export function addQuestionMarkToTypecheckCalls(
  lines: string[],
  isInResultFunction: (lineNum: number) => boolean,
): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isInResultFunction(i)) continue;
    if (lines[i].match(/^\s+typecheck_(expr|stmt|if_expr_branch)\([^)]+\);/)) {
      lines[i] = lines[i].replace(/;$/, "?;");
      count++;
    }
  }
  return count;
}

/**
 * Run a per-file migration over a list of absolute paths and return counts.
 * Eliminates the duplicated for-loop + summary-header in migrate-*.ts scripts.
 */
export function runFileMigration(
  files: string[],
  migrateFile: (file: string) => boolean,
): { totalModified: number; total: number } {
  let totalModified = 0;
  for (const file of files) {
    if (migrateFile(file)) {
      totalModified++;
    }
  }
  return { totalModified, total: files.length };
}
