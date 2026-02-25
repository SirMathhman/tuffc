// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(path.join(scriptDir, ".."));
const dbPath = path.join(root, "scripts", "test_cases.db");
const category = "migrated:multi-file-smoke";

function queryCount(categoryName: string): number {
  const pythonScript = [
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

  const attempts = [
    { cmd: "python", args: ["-c", pythonScript, dbPath, categoryName] },
    { cmd: "py", args: ["-3", "-c", pythonScript, dbPath, categoryName] },
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

  console.error(
    "[seed-db-multifile-smoke] Unable to query scripts/test_cases.db. Ensure Python 3 is installed and available as 'python' or 'py'.",
  );
  process.exit(1);
}

const count = queryCount(category);
if (count <= 0) {
  console.error(
    `[seed-db-multifile-smoke] Missing required DB rows for category '${category}'. Populate scripts/test_cases.db before running this suite.`,
  );
  process.exit(1);
}

console.log(
  `[seed-db-multifile-smoke] Category '${category}' already populated with ${count} case(s); no seeding needed.`,
);
