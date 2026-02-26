// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(path.join(scriptDir, ".."));
const dbPath = path.join(root, "scripts", "test_cases.db");
const category = "migrated:union-features";

const CASES = [
  {
    key: "union-inline-struct-basic",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: *Str; };",
      "let a : MyUnion = Variant1 { field: 42 };",
      'let b : MyUnion = Variant2 { field: "hello" };',
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-match-exhaustive",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  match (x) {",
      "    case struct Variant1 { field } = field;",
      "    case struct Variant2 { field } = field;",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-match-single-variant",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  match (x) {",
      "    case struct Variant1 { field } = field;",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-is-operator-narrowing",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  if (x is struct Variant1) {",
      "    x.field",
      "  } else {",
      "    x.field",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "result-inline-union-and-unwrap",
    source: [
      "type Result<T, E> = struct Ok { value: T; } | struct Err { error: E; };",
      "fn get(x: I32) : Result<I32, *Str> => {",
      "  if (x > 0) {",
      "    Ok<I32> { value: x }",
      "  } else {",
      '    Err<*Str> { error: "bad" }',
      "  }",
      "}",
      "fn main() : I32 => {",
      "  let r = get(1);",
      "  if (r is struct Ok) {",
      "    r.value",
      "  } else {",
      "    0",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
];

function runPython(args: string[]): {
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
    });
    if (result.status === 0) {
      return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    }
  }

  return { status: 1, stdout: "", stderr: "Unable to run python/py" };
}

const payloadJson = JSON.stringify(CASES);
const pythonScript = [
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
  "  key = case['key']",
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

const result = runPython(["-c", pythonScript, dbPath, category, payloadJson]);
if (result.status !== 0) {
  console.error(
    "[seed-db-union-features] Unable to seed scripts/test_cases.db. Ensure Python 3 is installed and available as 'python' or 'py'.",
  );
  if (result.stderr.trim().length > 0) {
    console.error(result.stderr.trim());
  }
  process.exit(1);
}

console.log(`[seed-db-union-features] ${result.stdout.trim()}`);
