/**
 * Shared helpers for profiling scripts.
 */
import path from "path";
export function selfhostPaths(dir: string) {
  return {
    inputPath: path.resolve(dir, "../src/main/tuff/selfhost.tuff"),
    outputPath: path.resolve(dir, "../tests/out/build/profile-test.js"),
    moduleBaseDir: path.resolve(dir, "../src/main/tuff"),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function printPhaseBreakdown(
  marks: Array<{ label: string; ms: number }>,
  msWidth = 8,
): void {
  const total = marks.find((m) => m.label === "total")?.ms ?? 0;
  const sorted = [...marks].sort((a, b) => b.ms - a.ms);
  for (const m of sorted) {
    const pct = total > 0 ? ((m.ms / total) * 100).toFixed(1) : "?";
    console.log(
      `  ${String(m.label).padEnd(30)} ${String(m.ms).padStart(msWidth)}ms  (${pct}%)`,
    );
  }
}

  return {
    backend: "selfhost",
    enableModules: true,
    modules: { moduleBaseDir },
    borrowcheck: { enabled: true },
    lint: { enabled: false, fix: false, mode: "error" },
    target: "js",
  };
}
