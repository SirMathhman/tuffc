/**
 * Shared utilities for seed-db-*.ts scripts.
 *
 * All seed scripts need the same Python invocation helper, the same SQL
 * schema-migration script, and the same "query existing row count" helper.
 * Centralising them here eliminates the duplicated ~100 lines across 5 files.
 */
// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(path.join(scriptDir, ".."));
export const dbPath = path.join(root, "scripts", "test_cases.db");

// ── Python runner ─────────────────────────────────────────────────────────────

export function runPython(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const attempts = [
    { cmd: "python", args },
    { cmd: "py", args: ["-3", ...args] },
  ];

  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== null) {
      return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    }
  }
  return { status: 1, stdout: "", stderr: "Unable to run python/py" };
}

// ── DB seeding ────────────────────────────────────────────────────────────────

/** Shared Python SQL script used by all seed-db scripts. */
const SEED_PYTHON_SCRIPT = [
  "import json, sqlite3, sys",
  "db = sys.argv[1]",
  "category = sys.argv[2]",
  "cases = json.loads(sys.argv[3])",
  "con = sqlite3.connect(db)",
  "cur = con.cursor()",
  "cur.execute('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)')",
  'existing = {r[1] for r in cur.execute("PRAGMA table_info(test_cases)").fetchall()}',
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
  "cur.execute('INSERT OR IGNORE INTO categories(name) VALUES (?)', (category,))",
  "cat_id = cur.execute('SELECT id FROM categories WHERE lower(name)=lower(?)', (category,)).fetchone()[0]",
  "cur.execute('DELETE FROM test_cases WHERE category_id = ?', (cat_id,))",
  "inserted = 0",
  "for case in cases:",
  "  src = case['source']",
  "  expects = int(case['expectsCompileError'])",
  "  code = case['expectedDiagnosticCode'] or None",
  "  cur.execute('''",
  "    INSERT INTO test_cases (",
  "      category_id, source_code, exit_code, expects_compile_error,",
  "      execution_mode, backend, target, compile_options_json,",
  "      expected_diagnostic_code, expected_runtime_json",
  "    ) VALUES (?, ?, 0, ?, 'compile-only', 'selfhost', 'js', '', ?, '')",
  "  ''', (cat_id, src, expects, code))",
  "  inserted += 1",
  "con.commit()",
  "total = cur.execute('SELECT COUNT(*) FROM test_cases WHERE category_id=?', (cat_id,)).fetchone()[0]",
  "print(f'inserted={inserted} total={total}')",
  "con.close()",
].join("\n");

export interface SeedCase {
  key?: string;
  source: string;
  expectsCompileError: number;
  expectedDiagnosticCode: string;
  [key: string]: unknown;
}

/**
 * Seed a category into the SQLite DB.  Exits the process with code 1 on failure.
 * @param scriptLabel  Used in error messages, e.g. "seed-db-union-features"
 * @param category     The category name to seed under
 * @param cases        Array of test cases to insert
 */
export function seedCategory(
  scriptLabel: string,
  category: string,
  cases: SeedCase[],
): void {
  const payloadJson = JSON.stringify(
    cases.map((c) => ({
      key: c.key ?? "",
      source: c.source,
      expectsCompileError: c.expectsCompileError,
      expectedDiagnosticCode: c.expectedDiagnosticCode,
    })),
  );

  const result = runPython([
    "-c",
    SEED_PYTHON_SCRIPT,
    dbPath,
    category,
    payloadJson,
  ]);

  if (result.status !== 0) {
    dbUnavailableError(scriptLabel, "seed");
  }
  console.log(`[${scriptLabel}] ${result.stdout.trim()}`);
}

// ── DB utilities ──────────────────────────────────────────────────────────────

const DB_NOT_AVAILABLE_MSG =
  "Ensure Python 3 is installed and available as 'python' or 'py'.";

function dbUnavailableError(scriptLabel: string, action: string): never {
  console.error(
    `[${scriptLabel}] Unable to ${action} scripts/test_cases.db. ${DB_NOT_AVAILABLE_MSG}`,
  );
  process.exit(1);
}

const QUERY_COUNT_SCRIPT = [
  "import sqlite3, sys",
  "db = sys.argv[1]",
  "category = sys.argv[2]",
  "con = sqlite3.connect(db)",
  "cur = con.cursor()",
  "row = cur.execute('''",
  "SELECT COUNT(*)",
  "FROM test_cases tc",
  "LEFT JOIN categories c ON c.id = tc.category_id",
  "WHERE lower(c.name) = lower(?)",
  "''', (category,)).fetchone()",
  "print(int(row[0]) if row else 0)",
].join("\n");

/**
 * Query the count of rows for a given category.  Exits with code 1 on failure.
 * @param scriptLabel  Used in error messages.
 * @param categoryName The category to count rows for.
 */
export function queryCount(scriptLabel: string, categoryName: string): number {
  const attempts = [
    {
      cmd: "python",
      args: ["-c", QUERY_COUNT_SCRIPT, dbPath, categoryName],
    },
    {
      cmd: "py",
      args: ["-3", "-c", QUERY_COUNT_SCRIPT, dbPath, categoryName],
    },
  ];

  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) continue;
    const parsed = Number.parseInt((result.stdout ?? "").trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  dbUnavailableError(scriptLabel, "query");
}

/**
 * Verify that a category already has rows in the DB; exit with code 1 if empty.
 * Used by scripts that don't seed themselves but require pre-seeded data.
 */
export function verifyCategory(scriptLabel: string, category: string): void {
  const count = queryCount(scriptLabel, category);
  if (count <= 0) {
    console.error(
      `[${scriptLabel}] Missing required DB rows for category '${category}'. Populate scripts/test_cases.db before running this suite.`,
    );
    process.exit(1);
  }
  console.log(
    `[${scriptLabel}] Category '${category}' already populated with ${count} case(s); no seeding needed.`,
  );
}
