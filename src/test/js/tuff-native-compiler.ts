// @ts-nocheck
/**
 * Verifies that the selfhost Tuff-to-C codegen (codegen_c.tuff) produces
 * valid C that compiles and runs correctly.
 *
 * This exercises:
 *   backend=selfhost   → the compiled selfhost bundle
 *   target=c           → codegen_c.tuff's generate_c() function
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileSourceResult } from "../../main/js/compiler.ts";
import {
  selectCCompiler,
  getRepoRootFromImportMeta,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = path.join(root, "tests", "out", "c-native");
fs.mkdirSync(outDir, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runCC(args: string[], label: string) {
  const result = spawnSync(COMPILER, args, { encoding: "utf8" });
  if (result.error) {
    console.error(
      `[native-codegen][${label}] failed to start: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[native-codegen][${label}] exit ${result.status}`);
    console.error(result.stdout ?? "");
    console.error(result.stderr ?? "");
    process.exit(1);
  }
  return result;
}

function selectCompiler() {
  const c = selectCCompiler("[native-codegen] using ");
  if (!c) {
    console.error("[native-codegen] no C compiler found (clang/gcc/cc)");
    process.exit(1);
  }
  return c;
}

const COMPILER = selectCompiler();

// ─── Test cases ───────────────────────────────────────────────────────────────

type TestCase = {
  name: string;
  source: string;
  expectedExitCode?: number;
  expectedOutput?: string;
  compileOptions?: Record<string, unknown>;
};

const cases: TestCase[] = [
  {
    name: "hello-world",
    source: `
extern let { print } = globalThis;
extern fn print(s: *Str) : I32;

fn main() : I32 => {
  print("hello from tuff");
    0
}
`,
    expectedExitCode: 0,
    expectedOutput: "hello from tuff",
  },
  {
    name: "arithmetic",
    source: `
fn add(a: I32, b: I32) : I32 => a + b;

fn main() : I32 => {
    let x = add(20, 22);
    x - 42
}
`,
    expectedExitCode: 0,
  },
  {
    name: "fibonacci",
    source: `
fn fib(n: I32) : I32 => {
    if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
}

fn main() : I32 => {
    let result = fib(10);
    result - 55
}
`,
    expectedExitCode: 0,
  },
  {
    name: "enum-basic",
    source: `
enum Color { Red, Green, Blue }

  fn color_to_int(c: Color) : I32 =>
    match (c) {
      case Red = 1;
      case Green = 2;
      case Blue = 3;
    };

fn main() : I32 => {
    let c = Color.Green;
    let v = color_to_int(c);
    v - 2
}
`,
    expectedExitCode: 0,
  },
  {
    name: "while-loop",
    source: `
fn sum(n: I32) : I32 => {
    let total = 0;
    let i = 0;
    while (i < n) {
        total = total + i;
        i = i + 1;
    }
    total
}

fn main() : I32 => {
    let s = sum(10);
    s - 45
}
`,
    expectedExitCode: 0,
  },
  {
    name: "substrate-free-basic",
    source: `
fn triple(x: I32) : I32 => x + x + x;

fn main() : I32 => {
    let v = triple(14);
    v - 42
}
`,
    expectedExitCode: 0,
    compileOptions: {
      cSubstrate: "",
    },
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const label = tc.name;
  console.log(`\n[native-codegen][${label}] compiling via selfhost+C...`);

  // Step 1: selfhost Tuff → C
  const result = compileSourceResult(tc.source, `<${label}>`, {
    backend: "selfhost",
    target: "c",
    typecheck: { strictSafety: false, __bootstrapRelaxed: true },
    lint: { enabled: false },
    borrowcheck: { enabled: false },
    ...(tc.compileOptions ?? {}),
  });

  if (!result.ok) {
    console.error(
      `[native-codegen][${label}] COMPILE ERROR: ${result.error.message}`,
    );
    failed++;
    continue;
  }

  const cSource = result.value?.output ?? result.value?.js ?? "";
  if (!cSource || cSource.length < 10) {
    console.error(`[native-codegen][${label}] EMPTY output`);
    failed++;
    continue;
  }

  const cPath = path.join(outDir, `${label}.c`);
  const exePath = path.join(
    outDir,
    process.platform === "win32" ? `${label}.exe` : label,
  );

  fs.writeFileSync(cPath, cSource, "utf8");
  console.log(
    `[native-codegen][${label}] wrote ${cPath} (${cSource.length} bytes)`,
  );

  // Step 2: compile C → executable
  const compileArgs = [cPath, "-O0", "-o", exePath];
  if (process.platform !== "win32") {
    compileArgs.push("-lm");
  }
  try {
    runCC(compileArgs, `${label}:cc`);
  } catch {
    failed++;
    continue;
  }
  console.log(`[native-codegen][${label}] compiled to ${exePath}`);

  // Step 3: run executable
  const run = spawnSync(exePath, [], { encoding: "utf8", timeout: 10_000 });
  const actualExit = run.status ?? -1;
  const actualOutput = (run.stdout ?? "") + (run.stderr ?? "");

  const expectedExit = tc.expectedExitCode ?? 0;
  if (actualExit !== expectedExit) {
    console.error(
      `[native-codegen][${label}] FAIL: exit ${actualExit}, expected ${expectedExit}`,
    );
    console.error(actualOutput);
    failed++;
    continue;
  }

  if (tc.expectedOutput && !actualOutput.includes(tc.expectedOutput)) {
    console.error(
      `[native-codegen:output][${label}] FAIL: expected to contain "${tc.expectedOutput}"`,
    );
    console.error(`actual: ${actualOutput}`);
    failed++;
    continue;
  }

  console.log(`[native-codegen][${label}] ✔ passed (exit=${actualExit})`);
  passed++;
}

console.log(`\n[native-codegen] results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
