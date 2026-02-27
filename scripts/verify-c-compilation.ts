import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { compileSourceResult } from "../src/main/js/compiler.ts";

interface TestCase {
  id: number;
  category: string;
  source_code: string;
  expects_compile_error: number;
}

// Read test cases from DB using Python subprocess
function getTestCases(): TestCase[] {
  const pythonScript = `
import sqlite3
import json
db = sqlite3.connect('./scripts/test_cases.db')
rows = db.execute('''
  SELECT tc.id, c.name, tc.source_code, tc.expects_compile_error 
  FROM test_cases tc 
  JOIN categories c ON tc.category_id=c.id 
  ORDER BY tc.id
''').fetchall()
for r in rows:
  print(json.dumps({'id': r[0], 'category': r[1], 'source': r[2], 'error': r[3]}))
`;

  const result = spawnSync("python", ["-c", pythonScript], {
    encoding: "utf-8",
    timeout: 10000,
  });

  if (result.error || result.status !== 0) {
    console.error("Python error:", result.stderr);
    process.exit(1);
  }

  const cases: TestCase[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      cases.push({
        id: data.id,
        category: data.category,
        source_code: data.source,
        expects_compile_error: data.error,
      });
    } catch (e) {
      console.error(`Failed to parse JSON: ${line}`);
    }
  }
  return cases;
}

function normalizeSource(src: string): string {
  const trimmed = src.replace(/[\s\u00A0]+$/g, "");
  if (trimmed.length === 0) return trimmed;
  return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
}

import {
  hasExplicitMain,
  wrapSnippetAsMain,
} from "../src/test/js/tuff-snippet-utils.ts";

// Attempt to verify C compilation
function verifyC(
  testId: number,
  source: string,
): { ok: boolean; error?: string } {
  // For C backend: compile directly (top-level fns are hoisted, stmts go into tuff_main).
  // Do NOT wrap in fn main() — that causes nested function issues in C.
  const compileResult = compileSourceResult(source, `<test-${testId}>`, {
    backend: "stage0",
    target: "c",
  });

  if (!compileResult.ok) {
    return {
      ok: false,
      error: `Tuff→C failed: ${compileResult.error.message}`,
    };
  }

  const cCode = String(compileResult.value.output);

  // Save C code
  mkdirSync("./build/c-verify", { recursive: true });
  const cFile = `./build/c-verify/test-${testId}.c`;
  writeFileSync(cFile, cCode);

  // Try to compile with clang
  try {
    execSync(`clang -c ${cFile} -o ./build/c-verify/test-${testId}.o 2>&1`, {
      timeout: 5000,
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    const stderr = e instanceof Error ? e.message : String(e);
    // Extract just the error lines, not the full spew
    const lines = stderr.split("\n");
    const errors = lines.filter((l) => l.includes("error:")).slice(0, 3);
    return {
      ok: false,
      error: `Clang compile failed: ${errors.join("; ") || stderr.slice(0, 200)}`,
    };
  }
}

async function main() {
  console.log("Reading test cases from DB...");
  const cases = getTestCases();
  console.log(`Found ${cases.length} test cases\n`);

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [] as Array<{ id: number; category: string; reason: string }>,
  };

  mkdirSync("./build/c-verify", { recursive: true });

  for (const testCase of cases) {
    const source = normalizeSource(testCase.source_code);

    // Skip tests that expect compile errors
    if (testCase.expects_compile_error) {
      results.skipped++;
      console.log(
        `[${String(testCase.id).padStart(2)}] ✓ ${testCase.category} (skipped - expects compile error)`,
      );
      continue;
    }

    const result = verifyC(testCase.id, source);
    if (result.ok) {
      results.passed++;
      console.log(
        `[${String(testCase.id).padStart(2)}] ✓ ${testCase.category}`,
      );
    } else {
      results.failed++;
      console.log(
        `[${String(testCase.id).padStart(2)}] ✗ ${testCase.category}`,
      );
      results.failures.push({
        id: testCase.id,
        category: testCase.category,
        reason: result.error || "Unknown error",
      });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(
    `Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`,
  );
  console.log("=".repeat(70));

  if (results.failures.length > 0) {
    console.log("\nFailed tests:");
    for (const { id, category, reason } of results.failures) {
      console.log(`  [${String(id).padStart(2)}] ${category}: ${reason}`);
    }
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
