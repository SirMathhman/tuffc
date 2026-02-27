#!/usr/bin/env tsx
/**
 * Shared utilities for one-off Tuff source migration scripts.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

export { fs, path };

export const TUFFC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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

/**
 * Internal: iterate over lines inside Result functions and apply a transform.
 * The callback receives the current line and its index; return true if the
 * line was modified (the callback is responsible for updating `lines[i]`).
 */
function transformResultLines(
  lines: string[],
  isInResultFunction: (lineNum: number) => boolean,
  transform: (line: string, i: number) => boolean,
): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isInResultFunction(i)) continue;
    if (transform(lines[i], i)) count++;
  }
  return count;
}

/** Returns the number of lines modified. */
export function addReturnToTcErrorCalls(
  lines: string[],
  isInResultFunction: (lineNum: number) => boolean,
): number {
  return lines.reduce((count, _line, i) => {
    if (!isInResultFunction(i)) return count;
    if (lines[i].match(/^\s+tc_error\(/) && !lines[i].match(/return\s+tc_error/)) {
      lines[i] = lines[i].replace(/(\s+)tc_error/, "$1return tc_error");
      return count + 1;
    }
    return count;
  }, 0);
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
  return transformResultLines(lines, isInResultFunction, (line, i) => {
    if (line.match(/^\s+typecheck_(expr|stmt|if_expr_branch)\([^)]+\);/)) {
      lines[i] = line.replace(/;$/, "?;");
      return true;
    }
    return false;
  });
}

/**
 * Wrap `return 0;` / `return 1;` and bare numeric final lines in Result
 * functions with `Ok<I32> { value: N }`.  Returns the number of lines
 * modified.
 */
export function addOkWrapToReturns(
  lines: string[],
  isInResultFunction: (lineNum: number) => boolean,
): number {
  let count = 0;
  count += transformResultLines(lines, isInResultFunction, (line, i) => {
    if (line.match(/^\s+return [01];$/)) {
      const num = line.match(/return ([01]);/)![1];
      lines[i] = line.replace(
        `return ${num};`,
        `return Ok<I32> { value: ${num} };`,
      );
      return true;
    }
    return false;
  });
  count += transformResultLines(lines, isInResultFunction, (line, i) => {
    if (
      line.match(/^\s+[01]\s*$/) &&
      i + 1 < lines.length &&
      lines[i + 1].match(/^}/)
    ) {
      const num = line.trim();
      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      lines[i] = `${indent}Ok<I32> { value: ${num} }`;
      return true;
    }
    return false;
  });
  return count;
}

/**
 * Write `content` back to `filePath` if `modified` is true.
 * Prints a standard ✅/ℹ️ message either way.
 */
export function saveIfModified(
  filePath: string,
  content: string,
  modified: boolean,
): void {
  if (modified) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  ✅ Saved changes`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }
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

/**
 * Run a migration set and print the standard summary header.
 * Avoids duplicating the `runFileMigration + console.log === Summary ===` block
 * across migrate-*.ts scripts.
 */
export function runMigrationMain(
  files: string[],
  migrateFile: (file: string) => boolean,
): { totalModified: number; total: number } {
  const result = runFileMigration(files, migrateFile);
  console.log(`\n=== Summary ===`);
  console.log(`Files modified: ${result.totalModified}/${result.total}`);
  return result;
}
