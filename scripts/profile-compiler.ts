/**
 * Bottleneck analyzer: Profiles compiler on test files and reports
 * compilation times.
 *
 * Usage:
 *   npx tsx ./scripts/profile-compiler.ts
 *   npx tsx ./scripts/profile-compiler.ts --verbose
 *
 * Output directory: tests/out/profile/
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");

const verbose = process.argv.includes("--verbose");

// ── Configuration ────────────────────────────────────────────────────────────

const OUT_DIR = path.join(root, "tests", "out", "profile");

// Test files: small, medium, large
const TEST_FILES = [
  {
    name: "factorial (small)",
    path: path.join(root, "src", "test", "tuff", "cases", "factorial.tuff"),
  },
  {
    name: "selfhost (large)",
    path: path.join(root, "src", "main", "tuff", "selfhost.tuff"),
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

interface CompileResult {
  file: string;
  successful: boolean;
  duration_ms?: number;
  error?: string;
}

function profileCompile(file: string): CompileResult {
  try {
    const t0 = Date.now();

    // Use the native selfhost CLI
    const nativeCliPath = path.join(
      root,
      "tests",
      "out",
      "c-bootstrap",
      process.platform === "win32"
        ? "stage3_selfhost_cli.exe"
        : "stage3_selfhost_cli",
    );

    if (!fs.existsSync(nativeCliPath)) {
      return {
        file,
        successful: false,
        error: `Native CLI not found at ${nativeCliPath}`,
      };
    }

    const result = spawnSync(
      nativeCliPath,
      [file, "-o", path.join(OUT_DIR, `${path.basename(file, ".tuff")}.js`)],
      { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );

    const duration_ms = Date.now() - t0;

    if (result.status !== 0) {
      const errorMsg = result.stderr || result.stdout || "Unknown error";
      if (verbose) {
        console.error(`\n[DEBUG] stderr: ${result.stderr}`);
        console.error(`[DEBUG] stdout: ${result.stdout}`);
        console.error(`[DEBUG] status: ${result.status}`);
      }
      return {
        file,
        successful: false,
        duration_ms,
        error: errorMsg.split("\n")[0],
      };
    }

    return { file, successful: true, duration_ms };
  } catch (err) {
    return {
      file,
      successful: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatProfileReport(results: CompileResult[]): string {
  let report = "";

  report += "╔═══════════════════════════════════════════════════════════╗\n";
  report += "║ Tuff Compiler Profiler — Phase 3 Bottleneck Report       ║\n";
  report += "╚═══════════════════════════════════════════════════════════╝\n\n";

  report += "⏱️  Compilation Times:\n";
  report += "─────────────────────────────────────────────────────────────\n";

  let totalTime = 0;
  const successCount = results.filter((r) => r.successful).length;

  for (const result of results) {
    if (!result.successful) {
      report += `  ❌ ${path.basename(result.file)}: ${result.error}\n`;
    } else {
      report += `  ✓ ${path.basename(result.file).padEnd(25)} ${result.duration_ms}ms\n`;
      if (result.duration_ms) totalTime += result.duration_ms;
    }
  }

  report += "\n";

  if (successCount > 0) {
    const avgTime = (totalTime / successCount).toFixed(0);
    report += "📊 Statistics:\n";
    report += "─────────────────────────────────────────────────────────────\n";
    report += `  • Total time (${successCount} files): ${totalTime}ms\n`;
    report += `  • Average time per file: ${avgTime}ms\n`;

    report += "\n";
  }

  report += "💡 Next Steps:\n";
  report += "─────────────────────────────────────────────────────────────\n";
  report += `  • Phase 1 (per-pass timing): ✅ Complete\n`;
  report += `    The compiler now tracks lex, parse, desugar, resolve, typecheck,\n`;
  report += `    borrowcheck, and emit pass times. Access via profile_take_json().\n\n`;
  report += `  • Phase 2 (sourcemaps): 🔜 In progress\n`;
  report += `    Will enable V8 profiler attribution to .tuff source files.\n\n`;
  report += `  • Phase 3 (bottleneck reporter): ✅ Complete\n`;
  report += `    Run 'npm run profile:compiler' to benchmark across test files.\n\n`;
  report += `  • To integrate Phase 1 with actual profiling:\n`;
  report += `    1. Modify src/test/js/cli.ts to capture profile_take_json() output\n`;
  report += `    2. Export timing data in JSON format for analysis\n`;
  report += `    3. Create visualization dashboards in tests/out/profile/\n`;

  report += "\n";

  return report;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(
    "[profile:compiler] Profiling compiler on test files (Phase 3)...\n",
  );

  const results: CompileResult[] = [];

  for (const test of TEST_FILES) {
    if (!fs.existsSync(test.path)) {
      console.log(`[profile:compiler] ⊘ skipped ${test.name} (file not found)`);
      results.push({
        file: test.path,
        successful: false,
        error: "File not found",
      });
      continue;
    }

    process.stdout.write(
      `[profile:compiler] profiling ${test.name.padEnd(25)}... `,
    );

    const result = profileCompile(test.path);
    results.push(result);

    if (result.successful) {
      console.log(`✓ ${result.duration_ms}ms`);
    } else {
      console.log(`✗ (error)`);
    }
  }

  console.log();

  // Generate report
  const report = formatProfileReport(results);
  console.log(report);

  // Save report
  const reportPath = path.join(OUT_DIR, "profile-report.txt");
  fs.writeFileSync(reportPath, report);
  console.log(
    `[profile:compiler] Report saved: ${path.relative(root, reportPath)}`,
  );

  // Save raw JSON
  const jsonPath = path.join(OUT_DIR, "profile-data.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      results.map((r) => ({
        file: path.basename(r.file),
        successful: r.successful,
        duration_ms: r.duration_ms,
        error: r.error,
      })),
      null,
      2,
    ),
  );
  console.log(
    `[profile:compiler] Raw data saved: ${path.relative(root, jsonPath)}`,
  );
}

main().catch((err) => {
  console.error("[profile:compiler] Fatal error:", err.message);
  if (verbose) console.error(err.stack);
  process.exit(1);
});
