// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";

type DbCase = {
  id: number;
  category: string;
  source_code: string;
  exit_code: number;
  expects_compile_error: number;
};

const root = getRepoRootFromImportMeta(import.meta.url);
const dbPath = path.join(root, "scripts", "test_cases.db");
const outDir = path.join(root, "tests", "out", "db-cases");
const backendArg = process.argv.find((arg) => arg.startsWith("--backend="));
const backend = backendArg ? backendArg.slice("--backend=".length) : "stage0";

function runPythonSqliteQuery(dbFilePath: string): DbCase[] {
  const pythonScript = [
    "import json, sqlite3, sys",
    "db = sys.argv[1]",
    "con = sqlite3.connect(db)",
    "cur = con.cursor()",
    "rows = cur.execute('''",
    "SELECT tc.id, c.name, tc.source_code, tc.exit_code, tc.expects_compile_error",
    "FROM test_cases tc",
    "LEFT JOIN categories c ON c.id = tc.category_id",
    "ORDER BY tc.id",
    "''').fetchall()",
    "payload = [",
    "  {",
    "    'id': int(r[0]),",
    "    'category': '' if r[1] is None else str(r[1]),",
    "    'source_code': '' if r[2] is None else str(r[2]),",
    "    'exit_code': int(r[3]),",
    "    'expects_compile_error': int(r[4]),",
    "  }",
    "  for r in rows",
    "]",
    "print(json.dumps(payload))",
  ].join("\n");

  const attempts = [
    { cmd: "python", args: ["-c", pythonScript, dbFilePath] },
    { cmd: "py", args: ["-3", "-c", pythonScript, dbFilePath] },
  ];

  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, {
      encoding: "utf8",
      cwd: root,
    });
    if (result.status !== 0) {
      continue;
    }

    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      console.error("Failed to parse SQLite query JSON output.");
      console.error(result.stdout);
      throw error;
    }
  }

  console.error(
    "Unable to query scripts/test_cases.db. Ensure Python 3 is installed and available as 'python' or 'py'.",
  );
  process.exit(1);
}

function normalizeSource(source: string): string {
  const trimmedRight = source.replace(/[\s\u00A0]+$/g, "");
  if (trimmedRight.length === 0) return trimmedRight;

  // GUI entries are often entered as expression snippets without a trailing ';'.
  // Normalize that so DB cases behave like source files in the rest of the suite.
  return trimmedRight.endsWith(";") ? trimmedRight : `${trimmedRight};`;
}

function hasExplicitMain(source: string): boolean {
  return /\bfn\s+main\s*\(/.test(source);
}

function wrapSnippetAsMain(source: string): string {
  return `fn main() => {\n${source}\n}`;
}

function toBool(value: number): boolean {
  return Number(value) !== 0;
}

if (!fs.existsSync(dbPath)) {
  console.error(`DB test source not found: ${dbPath}`);
  process.exit(1);
}

const dbCases = runPythonSqliteQuery(dbPath);
if (dbCases.length === 0) {
  console.log("[db-tests] No rows found in scripts/test_cases.db");
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

let passed = 0;
let failed = 0;

for (const testCase of dbCases) {
  const label = `db:${testCase.id}:${testCase.category || "uncategorized"}`;
  const source = normalizeSource(testCase.source_code ?? "");
  const expectsCompileError = toBool(testCase.expects_compile_error);

  const compileResult = compileSourceResult(source, `<${label}>`, {
    backend,
    target: "js",
  });

  if (expectsCompileError) {
    if (compileResult.ok) {
      failed += 1;
      console.error(
        `[db-tests] ✖ ${label} expected compile error, but compilation succeeded`,
      );
      continue;
    }

    passed += 1;
    console.log(`[db-tests] ✓ ${label} (compile error as expected)`);
    continue;
  }

  if (!compileResult.ok) {
    failed += 1;
    console.error(
      `[db-tests] ✖ ${label} failed to compile: ${compileResult.error.message}`,
    );
    continue;
  }

  let runtimeValue: unknown;
  let runtimeJs = compileResult.value.output;
  let wrappedExecutionUsed = false;

  const jsPath = path.join(outDir, `case-${testCase.id}.js`);
  fs.writeFileSync(jsPath, runtimeJs, "utf8");

  try {
    runtimeValue = runMainFromJs(runtimeJs, label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldTryWrappedExecution =
      !hasExplicitMain(source) && message.includes("main is not defined");

    if (shouldTryWrappedExecution) {
      const wrappedSource = wrapSnippetAsMain(source);
      const wrappedCompile = compileSourceResult(
        wrappedSource,
        `<${label}:wrapped>`,
        {
          backend,
          target: "js",
        },
      );

      if (!wrappedCompile.ok) {
        failed += 1;
        console.error(
          `[db-tests] ✖ ${label} runtime wrapper compile failed: ${wrappedCompile.error.message}`,
        );
        continue;
      }

      runtimeJs = wrappedCompile.value.output;
      wrappedExecutionUsed = true;
      fs.writeFileSync(
        path.join(outDir, `case-${testCase.id}.wrapped.js`),
        runtimeJs,
        "utf8",
      );

      try {
        runtimeValue = runMainFromJs(runtimeJs, `${label}:wrapped`);
      } catch (wrappedError) {
        failed += 1;
        console.error(
          `[db-tests] ✖ ${label} runtime failed after wrapper: ${wrappedError instanceof Error ? wrappedError.message : String(wrappedError)}`,
        );
        continue;
      }
    } else {
      failed += 1;
      console.error(`[db-tests] ✖ ${label} runtime failed: ${message}`);
      continue;
    }
  }

  // Normalize booleans: Tuff Bool maps to integer exit codes (false=0, true=1)
  const normalizedValue =
    runtimeValue === true ? 1 : runtimeValue === false ? 0 : runtimeValue;
  if (normalizedValue !== testCase.exit_code) {
    failed += 1;
    console.error(
      `[db-tests] ✖ ${label} expected exit ${testCase.exit_code}, got ${JSON.stringify(runtimeValue)}`,
    );
    continue;
  }

  passed += 1;
  console.log(
    `[db-tests] ✓ ${label}${wrappedExecutionUsed ? " (wrapped)" : ""}`,
  );
}

console.log(
  `\n[db-tests] Completed ${dbCases.length} case(s): ${passed} passed, ${failed} failed (backend=${backend})`,
);

if (failed > 0) {
  process.exit(1);
}
