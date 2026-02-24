// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dbPath = path.join(root, "scripts", "test_cases.db");
const testsDir = path.join(root, "tests");

type SeedCase = {
  file: string;
  expectsCompileError: boolean;
  executionMode: "js-runtime" | "compile-only";
  expectedRuntimeJson?: string;
};

const cases: SeedCase[] = [
  {
    file: "demo-array-bounds-fixed.tuff",
    expectsCompileError: true,
    executionMode: "compile-only",
  },
  {
    file: "demo-div-by-zero.tuff",
    expectsCompileError: true,
    executionMode: "compile-only",
  },
  {
    file: "demo-nullable-pointer.tuff",
    expectsCompileError: true,
    executionMode: "compile-only",
  },
  {
    file: "demo-overflow.tuff",
    expectsCompileError: true,
    executionMode: "compile-only",
  },
  {
    file: "demo-array-bounds.tuff",
    expectsCompileError: false,
    executionMode: "compile-only",
  },
  {
    file: "demo-c-interop.tuff",
    expectsCompileError: false,
    executionMode: "compile-only",
  },
  {
    file: "demo-div-by-zero-safe.tuff",
    expectsCompileError: false,
    executionMode: "js-runtime",
    expectedRuntimeJson: "5",
  },
  {
    file: "demo-overflow-call.tuff",
    expectsCompileError: false,
    executionMode: "compile-only",
  },
];

const payload = cases.map((c) => ({
  ...c,
  source: fs.readFileSync(path.join(testsDir, c.file), "utf8"),
}));

const pythonScript = [
  "import json, sqlite3, sys",
  "db_path = sys.argv[1]",
  "raw = sys.stdin.read()",
  "cases = json.loads(raw)",
  "con = sqlite3.connect(db_path)",
  "cur = con.cursor()",
  "existing = {r[1] for r in cur.execute(\"PRAGMA table_info(test_cases)\").fetchall()}",
  "needed = [",
  "  ('execution_mode', \"TEXT NOT NULL DEFAULT 'js-runtime'\"),",
  "  ('backend', \"TEXT NOT NULL DEFAULT 'selfhost'\"),",
  "  ('target', \"TEXT NOT NULL DEFAULT 'js'\"),",
  "  ('compile_options_json', \"TEXT NOT NULL DEFAULT ''\"),",
  "  ('expected_runtime_json', \"TEXT NOT NULL DEFAULT ''\"),",
  "]",
  "for (name, ddl) in needed:",
  "  if name not in existing:",
  "    cur.execute(f\"ALTER TABLE test_cases ADD COLUMN {name} {ddl}\")",
  "cur.execute(\"INSERT OR IGNORE INTO categories(name) VALUES (?)\", ('migrated:demo-regressions',))",
  "cat_id = cur.execute(\"SELECT id FROM categories WHERE name = ?\", ('migrated:demo-regressions',)).fetchone()[0]",
  "for c in cases:",
  "  row = cur.execute(\"SELECT id FROM test_cases WHERE category_id = ? AND source_code = ?\", (cat_id, c['source'])).fetchone()",
  "  expects = 1 if c['expectsCompileError'] else 0",
  "  mode = c['executionMode']",
  "  runtime_json = c.get('expectedRuntimeJson', '')",
  "  if row is None:",
  "    cur.execute('''",
  "      INSERT INTO test_cases(category_id, source_code, exit_code, expects_compile_error, execution_mode, backend, target, compile_options_json, expected_runtime_json)",
  "      VALUES (?, ?, 0, ?, ?, 'selfhost', 'js', ?, ?)",
  "    ''', (cat_id, c['source'], expects, mode, '{\"typecheck\":{\"strictSafety\":true}}', runtime_json))",
  "  else:",
  "    cur.execute('''",
  "      UPDATE test_cases",
  "      SET expects_compile_error = ?, execution_mode = ?, backend = 'selfhost', target = 'js', compile_options_json = ?, expected_runtime_json = ?",
  "      WHERE id = ?",
  "    ''', (expects, mode, '{\"typecheck\":{\"strictSafety\":true}}', runtime_json, row[0]))",
  "con.commit()",
  "print(f'seeded {len(cases)} demo regression case(s)')",
].join("\n");

const run = spawnSync("python", ["-c", pythonScript, dbPath], {
  cwd: root,
  encoding: "utf8",
  input: JSON.stringify(payload),
});

if (run.status !== 0) {
  const fallback = spawnSync("py", ["-3", "-c", pythonScript, dbPath], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
  if (fallback.status !== 0) {
    console.error(
      fallback.stderr || fallback.stdout || run.stderr || run.stdout,
    );
    process.exit(fallback.status ?? 1);
  }
  console.log(fallback.stdout.trim());
  process.exit(0);
}

console.log(run.stdout.trim());
