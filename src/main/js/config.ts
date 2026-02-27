import * as fs from "fs";
import * as path from "path";

export interface TuffLintConfig {
  maxEffectiveLines?: number;
  astDuplicates?: boolean;
}

export interface TuffConfig {
  lint?: TuffLintConfig;
}

/**
 * Returns the default Tuff configuration.
 */
export function defaultTuffConfig(): TuffConfig {
  return {
    lint: {
      maxEffectiveLines: 500,
      astDuplicates: true,
    },
  };
}

/**
 * Walks up the directory tree from `fromDir` to find a `tuff.json` config file.
 * Returns the parsed config merged with defaults, or just defaults if no config is found.
 */
export function loadTuffConfig(fromDir: string): TuffConfig {
  const defaults = defaultTuffConfig();
  let currentDir = path.resolve(fromDir);
  const root = path.parse(currentDir).root;

  // Walk up directory tree looking for tuff.json
  while (true) {
    const configPath = path.join(currentDir, "tuff.json");
    if (fs.existsSync(configPath)) {
      try {
        const configText = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(configText) as TuffConfig;
        // Merge with defaults
        return {
          lint: {
            ...defaults.lint,
            ...parsed.lint,
          },
        };
      } catch (error) {
        // If parse fails, warn and continue searching
        console.warn(
          `Warning: Failed to parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Stop at root
    if (currentDir === root) {
      break;
    }

    // Move up one directory
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  // No config found, return defaults
  return defaults;
}
