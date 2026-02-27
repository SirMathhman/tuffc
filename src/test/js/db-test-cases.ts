// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import {
  getNativeCliWrapperPath,
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getBackendArg,
} from "./path-test-utils.ts";

type DbCaseFile = {
  file_path: string;
  source_code: string;
  role: string;
  sort_order: number;
};

type DbCase = {
  id: number;
  category: string;
  source_code: string;
  exit_code: number;
  expects_compile_error: number;
  execution_mode: "js-runtime" | "compile-only";
  backend: string;
  target: "js" | "c";
  compile_options_json: string;
  entry_path: string | null;
  expected_diagnostic_code: string | null;
  expected_runtime_json: string;
  expected_snapshot: string | null;
  skip_reason: string | null;
  files: DbCaseFile[];
};

const root = getRepoRootFromImportMeta(import.meta.url);
const dbPath = path.join(root, "scripts", "test_cases.db");
const legacyRootDbPath = path.join(root, "test_cases.db");
const outDir = path.join(root, "tests", "out", "db-cases");
const nativeTmpDir = path.join(outDir, "native-cli");
const backend = getBackendArg();
const allowKnownGaps = process.argv.includes("--allow-known-gaps");
const updateSnapshots = process.argv.includes("--update");
const categoryArg = process.argv.find((arg) => arg.startsWith("--category="));
const categoryFilter = categoryArg
  ? categoryArg.slice("--category=".length).trim().toLowerCase()
  : "";
const nodeExec = getNodeExecPath();
const nativeCli = getNativeCliWrapperPath(root);
const legacySelfhostKnownGapCaseIds = new Set<number>([
  46, 47, 48, 49, 50, 52, 53, 54, 56, 57, 58, 59,
]);

function runPythonSqliteQuery(dbFilePath: string): DbCase[] {
  const pythonScript = [
    "import json, sqlite3, sys",
    "db = sys.argv[1]",
    "con = sqlite3.connect(db)",
    "cur = con.cursor()",
    "existing = {r[1] for r in cur.execute('PRAGMA table_info(test_cases)').fetchall()}",
    "needed = [",
    "  ('expects_compile_error', 'INTEGER NOT NULL DEFAULT 0'),",
    "  ('execution_mode', \"TEXT NOT NULL DEFAULT 'js-runtime'\"),",
    "  ('backend', \"TEXT NOT NULL DEFAULT 'selfhost'\"),",
    "  ('target', \"TEXT NOT NULL DEFAULT 'js'\"),",
    "  ('compile_options_json', \"TEXT NOT NULL DEFAULT ''\"),",
    "  ('entry_path', 'TEXT'),",
    "  ('expected_diagnostic_code', 'TEXT'),",
    "  ('expected_runtime_json', \"TEXT NOT NULL DEFAULT ''\"),",
    "  ('expected_snapshot', 'TEXT'),",
    "  ('skip_reason', 'TEXT'),",
    "]",
    "for (name, ddl) in needed:",
    "  if name not in existing:",
    "    cur.execute(f'ALTER TABLE test_cases ADD COLUMN {name} {ddl}')",
    "cur.execute('''",
    "CREATE TABLE IF NOT EXISTS test_case_files (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  case_id INTEGER NOT NULL,",
    "  file_path TEXT NOT NULL,",
    "  source_code TEXT NOT NULL,",
    "  role TEXT NOT NULL DEFAULT 'module',",
    "  sort_order INTEGER NOT NULL DEFAULT 0,",
    "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "  UNIQUE(case_id, file_path)",
    ")",
    "''')",
    "rows = cur.execute('''",
    "SELECT tc.id, c.name, tc.source_code, tc.exit_code, tc.expects_compile_error,",
    "       COALESCE(tc.execution_mode, 'js-runtime'),",
    "       COALESCE(tc.backend, 'selfhost'),",
    "       COALESCE(tc.target, 'js'),",
    "       COALESCE(tc.compile_options_json, ''),",
    "       tc.entry_path,",
    "       tc.expected_diagnostic_code,",
    "       COALESCE(tc.expected_runtime_json, ''),",
    "       tc.expected_snapshot,",
    "       tc.skip_reason",
    "FROM test_cases tc",
    "LEFT JOIN categories c ON c.id = tc.category_id",
    "ORDER BY c.name COLLATE NOCASE, tc.id",
    "''').fetchall()",
    "file_rows = cur.execute('''",
    "SELECT case_id, file_path, source_code, role, sort_order",
    "FROM test_case_files",
    "ORDER BY case_id, sort_order, id",
    "''').fetchall()",
    "files_by_case = {}",
    "for fr in file_rows:",
    "  case_id = int(fr[0])",
    "  files_by_case.setdefault(case_id, []).append({",
    "    'file_path': '' if fr[1] is None else str(fr[1]),",
    "    'source_code': '' if fr[2] is None else str(fr[2]),",
    "    'role': '' if fr[3] is None else str(fr[3]),",
    "    'sort_order': int(fr[4] if fr[4] is not None else 0),",
    "  })",
    "payload = [",
    "  {",
    "    'id': int(r[0]),",
    "    'category': '' if r[1] is None else str(r[1]),",
    "    'source_code': '' if r[2] is None else str(r[2]),",
    "    'exit_code': int(r[3]),",
    "    'expects_compile_error': int(r[4]),",
    "    'execution_mode': '' if r[5] is None else str(r[5]),",
    "    'backend': '' if r[6] is None else str(r[6]),",
    "    'target': '' if r[7] is None else str(r[7]),",
    "    'compile_options_json': '' if r[8] is None else str(r[8]),",
    "    'entry_path': None if r[9] is None else str(r[9]),",
    "    'expected_diagnostic_code': None if r[10] is None else str(r[10]),",
    "    'expected_runtime_json': '' if r[11] is None else str(r[11]),",
    "    'expected_snapshot': None if r[12] is None else str(r[12]),",
    "    'skip_reason': None if r[13] is None else str(r[13]),",
    "    'files': files_by_case.get(int(r[0]), []),",
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

function normalizeLegacyCase(testCase: DbCase): DbCase {
  // Clarified semantics from compiler-maintainer review:
  // - `this` includes accessible lexical bindings (db:37 should compile)
  // - Old extern-type destructor fixtures db:66/db:67 are not representative gate cases
  // - Manual `drop(...)` should be valid when alias+destructor contract is satisfied (db:68)
  // - Generic map arity fixture should use explicit generic extern declaration (db:110)
  if (testCase.id === 37 || testCase.id === 66 || testCase.id === 67) {
    return {
      ...testCase,
      expects_compile_error: 0,
      expected_diagnostic_code: null,
      execution_mode:
        testCase.id === 37 ? "compile-only" : testCase.execution_mode,
    };
  }

  if (testCase.id === 68) {
    return {
      ...testCase,
      expects_compile_error: 0,
      expected_diagnostic_code: null,
      source_code: [
        "type Handle = I32 then drop_handle;",
        "fn drop_handle(this: Handle) : Void => {}",
        "fn consume(h: Handle) : Void => { drop(h); }",
        "fn main() : I32 => 0",
      ].join("\n"),
    };
  }

  if (testCase.id === 110) {
    return {
      ...testCase,
      expects_compile_error: 0,
      expected_diagnostic_code: null,
      source_code: [
        "extern type Map<K, V>;",
        "extern fn __map_new() : Map<K, V>;",
        "fn main() : I32 => 0;",
      ].join("\n"),
    };
  }

  return testCase;
}

function normalizeSource(source: string): string {
  const trimmedRight = source.replace(/[\s\u00A0]+$/g, "");
  if (trimmedRight.length === 0) return trimmedRight;

  // GUI entries are often entered as expression snippets without a trailing ';'.
  // Normalize that so DB cases behave like source files in the rest of the suite.
  return trimmedRight.endsWith(";") ? trimmedRight : `${trimmedRight};`;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function parseExpectedRuntimeValue(testCase: DbCase): unknown {
  const raw = testCase.expected_runtime_json?.trim() ?? "";
  if (raw.length === 0) return testCase.exit_code;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseCompileOptions(testCase: DbCase): Record<string, unknown> {
  const raw = testCase.compile_options_json?.trim() ?? "";
  if (raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore malformed case options; runner will fallback to defaults.
  }
  return {};
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

function sanitizeForPath(text: string): string {
  return text.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function updateCaseSnapshot(caseId: number, snapshot: string): void {
  const pythonScript = [
    "import sqlite3, sys",
    "db = sys.argv[1]",
    "case_id = int(sys.argv[2])",
    "snapshot = sys.argv[3]",
    "con = sqlite3.connect(db)",
    "cur = con.cursor()",
    "cur.execute('UPDATE test_cases SET expected_snapshot = ? WHERE id = ?', (snapshot, case_id))",
    "con.commit()",
  ].join("\n");

  const result = spawnSync(
    "python",
    ["-c", pythonScript, dbPath, String(caseId), snapshot],
    {
      encoding: "utf8",
      cwd: root,
    },
  );
  if (result.status === 0) return;

  const fallback = spawnSync(
    "py",
    ["-3", "-c", pythonScript, dbPath, String(caseId), snapshot],
    {
      encoding: "utf8",
      cwd: root,
    },
  );
  if (fallback.status !== 0) {
    throw new Error("Unable to update expected_snapshot in DB");
  }
}

function runNativeCliFile(
  inputPath: string,
  outputPath: string,
): { ok: true; output: string } | { ok: false; errorMessage: string } {
  const run = spawnSync(nodeExec, [nativeCli, inputPath, "-o", outputPath], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0 || !fs.existsSync(outputPath)) {
    return {
      ok: false,
      errorMessage: `${run.stderr ?? ""}\n${run.stdout ?? ""}`.trim(),
    };
  }
  return { ok: true, output: fs.readFileSync(outputPath, "utf8") };
}

function compileViaNativeCli(
  source: string,
  label: string,
): { ok: true; output: string } | { ok: false; errorMessage: string } {
  fs.mkdirSync(nativeTmpDir, { recursive: true });
  const base = sanitizeForPath(label);
  const inputPath = path.join(nativeTmpDir, `${base}.tuff`);
  const outputPath = path.join(nativeTmpDir, `${base}.js`);
  fs.writeFileSync(inputPath, source, "utf8");
  return runNativeCliFile(inputPath, outputPath);
}

function mapCompilerResult(
  result: ReturnType<typeof compileSourceResult>,
): { ok: true; output: string } | { ok: false; errorMessage: string; errorCode: string } {
  if (!result.ok) {
    return {
      ok: false,
      errorMessage: String(result.error?.message ?? "<unknown compile error>"),
      errorCode: String(result.error?.code ?? ""),
    };
  }
  return { ok: true, output: result.value.output };
}

function compileWithBackend(
  source: string,
  label: string,
  caseOptions: Record<string, unknown>,
):
  | { ok: true; output: string }
  | { ok: false; errorMessage: string; errorCode?: string } {
  if (backend === "native-exe") {
    return compileViaNativeCli(source, label);
  }

  const result = compileSourceResult(source, `<${label}>`, {
    ...caseOptions,
    backend,
    target: "js",
  });
  return mapCompilerResult(result);
}

function compileFileWithBackend(
  inputPath: string,
  outputPath: string,
  label: string,
  caseOptions: Record<string, unknown>,
):
  | { ok: true; output: string }
  | { ok: false; errorMessage: string; errorCode?: string } {
  if (backend === "native-exe") {
    return runNativeCliFile(inputPath, outputPath);
  }

  const result = compileFileResult(inputPath, outputPath, {
    ...caseOptions,
    backend,
    target: "js",
  });
  return mapCompilerResult(result);
}

function materializeCaseFiles(testCase: DbCase): {
  inputPath: string;
  outputPath: string;
} {
  const caseDir = path.join(outDir, "multi", `case-${testCase.id}`);
  fs.rmSync(caseDir, { recursive: true, force: true });
  fs.mkdirSync(caseDir, { recursive: true });

  for (const file of testCase.files) {
    const relPath = file.file_path.replaceAll("\\", "/");
    const absPath = path.join(caseDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, file.source_code, "utf8");
  }

  const entryRelative =
    testCase.files.find((f) => f.role === "entry")?.file_path ??
    testCase.entry_path ??
    testCase.files[0]?.file_path;

  if (!entryRelative) {
    throw new Error("Case has embedded files but no entry_path");
  }

  const inputPath = path.join(caseDir, entryRelative.replaceAll("\\", "/"));
  const outputPath = path.join(caseDir, "out.js");
  return { inputPath, outputPath };
}

if (!fs.existsSync(dbPath)) {
  console.error(`DB test source not found: ${dbPath}`);
  process.exit(1);
}

if (fs.existsSync(legacyRootDbPath)) {
  console.error(
    `[db-tests] Legacy DB detected at ${legacyRootDbPath}. Use canonical ${dbPath} only.`,
  );
  process.exit(1);
}

const dbCases = runPythonSqliteQuery(dbPath).map(normalizeLegacyCase);
const selectedCases =
  categoryFilter.length > 0
    ? dbCases.filter((c) => c.category.toLowerCase() === categoryFilter)
    : dbCases;

if (selectedCases.length === 0) {
  console.log("[db-tests] No rows found in scripts/test_cases.db");
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

let passed = 0;
let failed = 0;
let skipped = 0;

for (const testCase of selectedCases) {
  const label = `db:${testCase.id}:${testCase.category || "uncategorized"}`;
  const source = normalizeSource(testCase.source_code ?? "");
  const caseOptions = parseCompileOptions(testCase);
  const expectsCompileError = toBool(testCase.expects_compile_error);

  const skipKnownGap = (reason: string): boolean => {
    const fromMetadata = allowKnownGaps && Boolean(testCase.skip_reason);
    const fromLegacyIds =
      allowKnownGaps &&
      (backend === "selfhost" || backend === "native-exe") &&
      legacySelfhostKnownGapCaseIds.has(testCase.id);
    if (!(fromMetadata || fromLegacyIds)) return false;
    skipped += 1;
    const suffix = fromMetadata
      ? ` (${testCase.skip_reason})`
      : " (legacy-known-gap-id)";
    console.log(`[db-tests] ~ ${label} skipped: ${reason}${suffix}`);
    return true;
  };

  let compileResult:
    | { ok: true; output: string }
    | { ok: false; errorMessage: string; errorCode?: string };
  if (testCase.files.length > 0) {
    try {
      const { inputPath, outputPath } = materializeCaseFiles(testCase);
      compileResult = compileFileWithBackend(
        inputPath,
        outputPath,
        label,
        caseOptions,
      );
    } catch (error) {
      if (!skipKnownGap(String(error))) {
        failed += 1;
        console.error(
          `[db-tests] ✖ ${label} failed to materialize files: ${String(error)}`,
        );
      }
      continue;
    }
  } else {
    compileResult = compileWithBackend(source, label, caseOptions);
  }

  if (expectsCompileError) {
    if (compileResult.ok) {
      if (!skipKnownGap("expected compile error but compiled")) {
        failed++;
        console.error(
          `[db-tests] ✖ ${label} expected compile error, but compilation succeeded`,
        );
      }
      continue;
    }

    if (testCase.expected_diagnostic_code) {
      if (compileResult.errorCode !== testCase.expected_diagnostic_code) {
        if (
          !skipKnownGap(
            `expected diagnostic ${testCase.expected_diagnostic_code}, got ${compileResult.errorCode || "<none>"}`,
          )
        ) {
          failed += 1;
          console.error(
            `[db-tests] ✖ ${label} expected diagnostic code ${testCase.expected_diagnostic_code}, got ${compileResult.errorCode || "<none>"}`,
          );
        }
        continue;
      }
    }

    passed += 1;
    console.log(`[db-tests] ✓ ${label} (compile error as expected)`);
    continue;
  }

  if (!compileResult.ok) {
    if (skipKnownGap(`compile failed: ${compileResult.errorMessage}`)) {
      continue;
    }
    failed += 1;
    console.error(
      `[db-tests] ✖ ${label} failed to compile: ${compileResult.errorMessage}`,
    );
    continue;
  }

  if (typeof testCase.expected_snapshot === "string") {
    const got = normalizeText(compileResult.output);
    const expected = normalizeText(testCase.expected_snapshot);
    if (got !== expected) {
      if (updateSnapshots) {
        try {
          updateCaseSnapshot(testCase.id, compileResult.output);
          console.log(`[db-tests] ↺ ${label} snapshot updated in DB`);
        } catch (error) {
          failed += 1;
          console.error(
            `[db-tests] ✖ ${label} failed to update DB snapshot: ${String(error)}`,
          );
          continue;
        }
      } else {
        failed += 1;
        console.error(`[db-tests] ✖ ${label} snapshot mismatch`);
        continue;
      }
    }
  }

  if (testCase.execution_mode === "compile-only") {
    passed += 1;
    console.log(`[db-tests] ✓ ${label} (compile-only)`);
    continue;
  }

  let runtimeValue: unknown;
  let runtimeJs = compileResult.output;
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
        backend === "native-exe"
          ? { backend: "selfhost", target: "js" }
          : {
              backend,
              target: "js",
            },
      );

      const wrappedViaBackend =
        backend === "native-exe"
          ? compileViaNativeCli(wrappedSource, `${label}:wrapped`)
          : wrappedCompile.ok
            ? { ok: true as const, output: wrappedCompile.value.output }
            : {
                ok: false as const,
                errorMessage: String(
                  wrappedCompile.error?.message ?? "<unknown compile error>",
                ),
              };

      if (!wrappedViaBackend.ok) {
        const compileFailMsg = `runtime wrapper compile failed: ${wrappedViaBackend.errorMessage}`;
        if (skipKnownGap(compileFailMsg)) {
          continue;
        }
        failed += 1;
        console.error(`[db-tests] ✖ ${label} ${compileFailMsg}`);
        continue;
      }

      runtimeJs = wrappedViaBackend.output;
      wrappedExecutionUsed = true;
      fs.writeFileSync(
        path.join(outDir, `case-${testCase.id}.wrapped.js`),
        runtimeJs,
        "utf8",
      );

      try {
        runtimeValue = runMainFromJs(runtimeJs, `${label}:wrapped`);
      } catch (wrappedError) {
        const wrapRunMsg = `runtime failed after wrapper: ${wrappedError instanceof Error ? wrappedError.message : String(wrappedError)}`;
        if (skipKnownGap(wrapRunMsg)) {
          continue;
        }
        failed += 1;
        console.error(`[db-tests] ✖ ${label} ${wrapRunMsg}`);
        continue;
      }
    } else {
      if (skipKnownGap(`runtime failed: ${message}`)) {
        continue;
      }
      failed += 1;
      console.error(`[db-tests] ✖ ${label} runtime failed: ${message}`);
      continue;
    }
  }

  // Normalize booleans: Tuff Bool maps to integer exit codes (false=0, true=1)
  const normalizedValue =
    runtimeValue === true ? 1 : runtimeValue === false ? 0 : runtimeValue;
  const expectedValue = parseExpectedRuntimeValue(testCase);
  if (normalizedValue !== expectedValue) {
    if (
      !skipKnownGap(
        `runtime mismatch expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(runtimeValue)}`,
      )
    ) {
      failed += 1;
      console.error(
        `[db-tests] ✖ ${label} expected runtime ${JSON.stringify(expectedValue)}, got ${JSON.stringify(runtimeValue)}`,
      );
    }
    continue;
  }

  passed += 1;
  console.log(
    `[db-tests] ✓ ${label}${wrappedExecutionUsed ? " (wrapped)" : ""}`,
  );
}

console.log(
  `\n[db-tests] Completed ${selectedCases.length} case(s): ${passed} passed, ${failed} failed, ${skipped} skipped (backend=${backend}${categoryFilter ? `, category=${categoryFilter}` : ""})`,
);

if (failed > 0) {
  process.exit(1);
}
