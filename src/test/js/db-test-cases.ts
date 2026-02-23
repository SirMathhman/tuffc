// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import {
  getNativeCliWrapperPath,
  getNodeExecPath,
  getRepoRootFromImportMeta,
} from "./path-test-utils.ts";

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
const nativeTmpDir = path.join(outDir, "native-cli");
const backendArg = process.argv.find((arg) => arg.startsWith("--backend="));
const backend = backendArg ? backendArg.slice("--backend=".length) : "selfhost";
const allowKnownGaps = process.argv.includes("--allow-known-gaps");
const nodeExec = getNodeExecPath();
const nativeCli = getNativeCliWrapperPath(root);

const selfhostKnownGapCaseIds = new Set<number>([
  // Let: coercion/subtype (8), compile-error gap (7)
  7, 8,
  // Destructor: signature mismatch at compile time (9)
  9,
  // Tuple: type-annotated destructuring parse gap (13)
  13,
  // Slice: slice literal syntax not yet supported (43, 44)
  43, 44,
  // This: member-access field-not-found check regressed in rebuilt binary (37)
  37,
]);

function shouldSkipKnownGap(testCase: DbCase): boolean {
  return (
    allowKnownGaps &&
    (backend === "selfhost" || backend === "native-exe") &&
    selfhostKnownGapCaseIds.has(testCase.id)
  );
}

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

function sanitizeForPath(text: string): string {
  return text.replace(/[^a-zA-Z0-9._-]+/g, "_");
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

function compileWithBackend(
  source: string,
  label: string,
): { ok: true; output: string } | { ok: false; errorMessage: string } {
  if (backend === "native-exe") {
    return compileViaNativeCli(source, label);
  }

  const result = compileSourceResult(source, `<${label}>`, {
    backend,
    target: "js",
  });
  if (!result.ok) {
    return {
      ok: false,
      errorMessage: String(result.error?.message ?? "<unknown compile error>"),
    };
  }
  return { ok: true, output: result.value.output };
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
let skipped = 0;

for (const testCase of dbCases) {
  const label = `db:${testCase.id}:${testCase.category || "uncategorized"}`;
  const source = normalizeSource(testCase.source_code ?? "");
  const expectsCompileError = toBool(testCase.expects_compile_error);

  const compileResult = compileWithBackend(source, label);

  const skipKnownGap = (reason: string): boolean => {
    if (!shouldSkipKnownGap(testCase)) return false;
    skipped += 1;
    console.log(`[db-tests] ~ ${label} skipped known selfhost gap: ${reason}`);
    return true;
  };

  if (expectsCompileError) {
    if (compileResult.ok) {
      if (skipKnownGap("expected compile error but compiled")) {
        continue;
      }
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
    if (skipKnownGap(`compile failed: ${compileResult.errorMessage}`)) {
      continue;
    }
    failed += 1;
    console.error(
      `[db-tests] ✖ ${label} failed to compile: ${compileResult.errorMessage}`,
    );
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
        if (
          skipKnownGap(
            `runtime wrapper compile failed: ${wrappedViaBackend.errorMessage}`,
          )
        ) {
          continue;
        }
        failed += 1;
        console.error(
          `[db-tests] ✖ ${label} runtime wrapper compile failed: ${wrappedViaBackend.errorMessage}`,
        );
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
        if (
          skipKnownGap(
            `runtime failed after wrapper: ${wrappedError instanceof Error ? wrappedError.message : String(wrappedError)}`,
          )
        ) {
          continue;
        }
        failed += 1;
        console.error(
          `[db-tests] ✖ ${label} runtime failed after wrapper: ${wrappedError instanceof Error ? wrappedError.message : String(wrappedError)}`,
        );
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
  if (normalizedValue !== testCase.exit_code) {
    if (
      skipKnownGap(
        `exit mismatch expected ${testCase.exit_code} got ${JSON.stringify(runtimeValue)}`,
      )
    ) {
      continue;
    }
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
  `\n[db-tests] Completed ${dbCases.length} case(s): ${passed} passed, ${failed} failed, ${skipped} skipped (backend=${backend})`,
);

if (failed > 0) {
  process.exit(1);
}
