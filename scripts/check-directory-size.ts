import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const MAX_FILES_PER_DIR = 15;
const SRC_DIR = "src";

interface DirectoryInfo {
  path: string;
  fileCount: number;
}

function countFilesInDirectory(dirPath: string): number {
  let count = 0;
  const entries = readdirSync(dirPath);
  let i = 0;
  while (i < entries.length) {
    const fullPath = join(dirPath, entries[i]);
    const stats = statSync(fullPath);
    if (stats.isFile()) {
      count++;
    }
    i++;
  }
  return count;
}

function collectDirectories(
  basePath: string,
  directories: DirectoryInfo[],
): void {
  const entries = readdirSync(basePath);
  let i = 0;
  while (i < entries.length) {
    const fullPath = join(basePath, entries[i]);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      const fileCount = countFilesInDirectory(fullPath);
      directories.push({
        path: relative(".", fullPath),
        fileCount,
      });
      collectDirectories(fullPath, directories);
    }
    i++;
  }
}

function main(): void {
  const directories: DirectoryInfo[] = [];

  // Check the src directory itself
  const srcFileCount = countFilesInDirectory(SRC_DIR);
  directories.push({
    path: SRC_DIR,
    fileCount: srcFileCount,
  });

  // Check all subdirectories
  collectDirectories(SRC_DIR, directories);

  let foundViolations = false;
  let i = 0;
  while (i < directories.length) {
    const dir = directories[i];
    if (dir.fileCount > MAX_FILES_PER_DIR) {
      if (!foundViolations) {
        console.error(
          `\nDirectory size check failed: Maximum ${MAX_FILES_PER_DIR} files per directory\n`,
        );
        foundViolations = true;
      }
      console.error(
        `✗ ${dir.path} has ${dir.fileCount} files (exceeds limit by ${dir.fileCount - MAX_FILES_PER_DIR})`,
      );
    }
    i++;
  }

  if (foundViolations) {
    console.error(
      `\nPlease refactor directories with too many files into subdirectories or consolidate related functionality.\n`,
    );
    process.exit(1);
  }
}

main();
