import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export function getRepoRootFromImportMeta(importMetaUrl: string): string {
  const thisFile = fileURLToPath(importMetaUrl);
  return path.resolve(path.dirname(thisFile), "..", "..", "..");
}

export function getTsxCliPath(root: string): string {
  return path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
}

export function getNativeCliWrapperPath(root: string): string {
  return path.join(root, "scripts", "tuffc-native.mjs");
}

export function getCLIPaths(importMetaUrl: string) {
  const root = getRepoRootFromImportMeta(importMetaUrl);
  return {
    root,
    tsxCli: getTsxCliPath(root),
    nodeExec: getNodeExecPath(),
    nativeCli: getNativeCliWrapperPath(root),
  };
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

export function getBackendArg(): string {
  const backendArg = process.argv.find((arg) => arg.startsWith("--backend="));
  return backendArg ? backendArg.slice("--backend=".length) : "selfhost";
}

export function getTestsOutDir(root: string, ...parts: string[]): string {
  return path.join(root, "tests", "out", ...parts);
}

export function getSrcDir(root: string): string {
  return path.join(root, "src");
}

export function selectCCompiler(logPrefix = ""): string {
  const candidates =
    process.platform === "win32"
      ? ["clang", "gcc", "cc"]
      : ["cc", "clang", "gcc"];
  for (const c of candidates) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (r.status === 0) {
      const v = (r.stdout ?? "").split(/\r?\n/)[0] ?? "";
      console.log(`${logPrefix}C compiler: ${c}  (${v})`);
      return c;
    }
  }
  return "";
}

export function createBuildRunUtils(logPrefix: string) {
  function formatBytes(n: number): string {
    if (!Number.isFinite(n)) return "unknown";
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KiB`;
    return `${(n / (1024 * 1024)).toFixed(2)}MiB`;
  }

  function debugFile(label: string, filePath: string): void {
    const exists = fs.existsSync(filePath);
    if (!exists) {
      console.log(`[${logPrefix}][debug] ${label}: missing (${filePath})`);
      return;
    }
    const stat = fs.statSync(filePath);
    console.log(
      `[${logPrefix}][debug] ${label}: ${filePath} size=${formatBytes(stat.size)} mtime=${stat.mtime.toISOString()}`,
    );
  }

  function runStep(
    command: string,
    args: string[],
    opts: Record<string, unknown> = {},
  ) {
    const started = Date.now();
    console.log(`[${logPrefix}][run] ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, { encoding: "utf8", ...opts });
    const elapsed = Date.now() - started;
    console.log(
      `[${logPrefix}][run] done exit=${result.status} signal=${result.signal ?? "none"} ms=${elapsed}`,
    );
    if (result.error) {
      console.log(`[${logPrefix}][run] error: ${result.error.message}`);
    }
    return result;
  }

  return { formatBytes, debugFile, runStep };
}
