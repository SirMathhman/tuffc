// @ts-nocheck
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, "scripts", "test_cases.db");

const entryPath = "app.tuff";
const files = [
  {
    file_path: "app.tuff",
    role: "entry",
    sort_order: 0,
    source_code: [
      "let { add } = com::meti::Math;",
      "fn main() : I32 => add(20, 22);",
      "",
    ].join("\n"),
  },
  {
    file_path: "com/meti/Math.tuff",
    role: "module",
    sort_order: 1,
    source_code: [
      "out fn add(a : I32, b : I32) : I32 => a + b;",
      "",
    ].join("\n"),
  },
];

const payload = {
  category: "migrated:multi-file-smoke",
  source_code: "// multi-file case uses test_case_files; source_code retained for compatibility",
  expects_compile_error: 0,
  execution_mode: "js-runtime",
  backend: "selfhost",
  target: "js",
  compile_options_json: "",
  entry_path: entryPath,
  expected_runtime_json: "42",
  files,
};

const python = [
  "import json, sqlite3, sys",
  "db = sys.argv[1]",
  "payload = json.loads(sys.stdin.read())",
  "con = sqlite3.connect(db)",
  "cur = con.cursor()",
  "cur.execute(\"INSERT OR IGNORE INTO categories(name) VALUES (?)\", (payload['category'],))",
  "cat_id = cur.execute(\"SELECT id FROM categories WHERE name = ?\", (payload['category'],)).fetchone()[0]",
  "case_ids = [r[0] for r in cur.execute(\"SELECT id FROM test_cases WHERE category_id = ?\", (cat_id,)).fetchall()]",
  "for cid in case_ids:",
  "  cur.execute(\"DELETE FROM test_case_files WHERE case_id = ?\", (cid,))",
  "cur.execute(\"DELETE FROM test_cases WHERE category_id = ?\", (cat_id,))",
  "cur.execute('''",
  "  INSERT INTO test_cases(category_id, source_code, exit_code, expects_compile_error, execution_mode, backend, target, compile_options_json, entry_path, expected_runtime_json)",
  "  VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)",
  "''', (cat_id, payload['source_code'], payload['expects_compile_error'], payload['execution_mode'], payload['backend'], payload['target'], payload['compile_options_json'], payload['entry_path'], payload['expected_runtime_json']))",
  "case_id = cur.lastrowid",
  "cur.execute(\"DELETE FROM test_case_files WHERE case_id = ?\", (case_id,))",
  "for f in payload['files']:",
  "  cur.execute('''",
  "    INSERT INTO test_case_files(case_id, file_path, source_code, role, sort_order)",
  "    VALUES (?, ?, ?, ?, ?)",
  "  ''', (case_id, f['file_path'], f['source_code'], f['role'], int(f['sort_order'])))",
  "con.commit()",
  "print(f'seeded multi-file case id={case_id}')",
].join("\n");

const run = spawnSync("python", ["-c", python, dbPath], {
  cwd: root,
  encoding: "utf8",
  input: JSON.stringify(payload),
});

if (run.status !== 0) {
  const fallback = spawnSync("py", ["-3", "-c", python, dbPath], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
  if (fallback.status !== 0) {
    console.error(fallback.stderr || fallback.stdout || run.stderr || run.stdout);
    process.exit(fallback.status ?? 1);
  }
  console.log(fallback.stdout.trim());
  process.exit(0);
}

console.log(run.stdout.trim());
