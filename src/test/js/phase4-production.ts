import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

type ResultUnknown =
  | { ok: true; value: unknown }
  | { ok: false; error: unknown };

function unwrapErr(result: ResultUnknown): unknown {
  if ("error" in result) {
    return result.error;
  }
  console.error("Expected error Result, got ok");
  process.exit(1);
}

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const outDir = path.join(root, "tests", "out", "stage4");
fs.mkdirSync(outDir, { recursive: true });

// 1) Ensure internal diagnostics contain codes/hints for strict safety failures.
const strictResult = compileSourceResult(
  `fn bad(x : I32) : I32 => 100 / x;`,
  "<phase4>",
  {
    typecheck: { strictSafety: true },
  },
);
if (strictResult.ok) {
  console.error("Phase 4 diagnostics test expected strict compile failure");
  process.exit(1);
}
const strictDiag = toDiagnostic(unwrapErr(strictResult));
if (strictDiag.code !== "E_SAFETY_DIV_BY_ZERO") {
  console.error(`Expected E_SAFETY_DIV_BY_ZERO, got ${strictDiag.code}`);
  process.exit(1);
}
if (!strictDiag.hint || !strictDiag.hint.includes("denominator")) {
  console.error(
    `Expected diagnostic hint about denominator, got: ${strictDiag.hint}`,
  );
  process.exit(1);
}
for (const key of ["source", "cause", "reason", "fix"]) {
  if (!strictDiag[key] || typeof strictDiag[key] !== "string") {
    console.error(
      `Expected diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

// 1b) Selfhost backend should also enforce strict-safety diagnostics contract.
const strictSelfhostResult = compileSourceResult(
  `fn bad(x : I32) : I32 => 100 / x;`,
  "<phase4-selfhost>",
  {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  },
);
if (strictSelfhostResult.ok) {
  console.error("Selfhost strict-safety test expected compile failure");
  process.exit(1);
}
const strictSelfhostDiag = toDiagnostic(unwrapErr(strictSelfhostResult));
if (strictSelfhostDiag.code !== "E_SAFETY_DIV_BY_ZERO") {
  console.error(
    `Expected E_SAFETY_DIV_BY_ZERO (selfhost), got ${strictSelfhostDiag.code}`,
  );
  process.exit(1);
}

const nullableGuardResult = compileSourceResult(
  `fn bad(p : *I32 | 0USize) : I32 => p[0];`,
  "<phase4-nullable-guard>",
  {
    typecheck: { strictSafety: true },
  },
);
if (nullableGuardResult.ok) {
  console.error("Expected nullable-pointer strict-safety compile failure");
  process.exit(1);
}
const nullableGuardDiag = toDiagnostic(unwrapErr(nullableGuardResult));
if (nullableGuardDiag.code !== "E_SAFETY_NULLABLE_POINTER_GUARD") {
  console.error(
    `Expected E_SAFETY_NULLABLE_POINTER_GUARD, got ${nullableGuardDiag.code}`,
  );
  process.exit(1);
}
for (const key of ["source", "cause", "reason", "fix"]) {
  if (!nullableGuardDiag[key] || typeof nullableGuardDiag[key] !== "string") {
    console.error(
      `Expected nullable-pointer diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

const borrowGuardResult = compileSourceResult(
  `struct Box { v : I32 }\nfn bad() : I32 => { let b : Box = Box { v: 1 }; let moved : Box = b; b.v }`,
  "<phase4-borrow-use-after-move>",
);
if (borrowGuardResult.ok) {
  console.error("Expected borrow-checker compile failure");
  process.exit(1);
}
const borrowGuardDiag = toDiagnostic(unwrapErr(borrowGuardResult));
if (borrowGuardDiag.code !== "E_BORROW_USE_AFTER_MOVE") {
  console.error(
    `Expected E_BORROW_USE_AFTER_MOVE, got ${borrowGuardDiag.code}`,
  );
  process.exit(1);
}
for (const key of ["source", "cause", "reason", "fix"]) {
  if (!borrowGuardDiag[key] || typeof borrowGuardDiag[key] !== "string") {
    console.error(
      `Expected borrow diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

const copyAliasInvalid = compileSourceResult(
  `struct Box { v : I32 }\ncopy type BoxAlias = Box;\nfn main() : I32 => 0;`,
  "<phase4-copy-alias-invalid>",
);
if (copyAliasInvalid.ok) {
  console.error("Expected invalid copy alias compile failure");
  process.exit(1);
}
const copyAliasDiag = toDiagnostic(unwrapErr(copyAliasInvalid));
if (copyAliasDiag.code !== "E_BORROW_INVALID_COPY_ALIAS") {
  console.error(
    `Expected E_BORROW_INVALID_COPY_ALIAS, got ${copyAliasDiag.code}`,
  );
  process.exit(1);
}
for (const key of ["source", "cause", "reason", "fix"]) {
  if (!copyAliasDiag[key] || typeof copyAliasDiag[key] !== "string") {
    console.error(
      `Expected copy-alias diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

// 2) Ensure CLI emits machine-readable JSON diagnostics.
const failingFile = path.join(outDir, "cli-fail.tuff");
fs.writeFileSync(failingFile, `fn bad(x : I32) : I32 => 100 / x;`, "utf8");

const cli = spawnSync(
  process.execPath,
  [
    tsxCli,
    "./src/main/js/cli.ts",
    "compile",
    failingFile,
    "--stage2",
    "--json-errors",
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (cli.status === 0) {
  console.error("CLI expected failure status for invalid strict-safety input");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse((cli.stderr ?? "").trim());
} catch {
  console.error("CLI did not emit valid JSON diagnostics to stderr");
  console.error(cli.stderr);
  process.exit(1);
}

if (parsed.code !== "E_SAFETY_DIV_BY_ZERO") {
  console.error(
    `Expected CLI diagnostic code E_SAFETY_DIV_BY_ZERO, got ${parsed.code}`,
  );
  process.exit(1);
}

for (const key of ["source", "cause", "reason", "fix"]) {
  if (!parsed[key] || typeof parsed[key] !== "string") {
    console.error(
      `Expected CLI diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

// 3) Ensure lint diagnostics use the same 4-part contract.
const lintFailingFile = path.join(outDir, "cli-lint-fail.tuff");
fs.writeFileSync(
  lintFailingFile,
  `fn main() : I32 => { let unused : I32 = 1; 0 }`,
  "utf8",
);

const lintCli = spawnSync(
  process.execPath,
  [
    tsxCli,
    "./src/main/js/cli.ts",
    "compile",
    lintFailingFile,
    "--stage0",
    "--lint",
    "--lint-strict",
    "--json-errors",
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (lintCli.status === 0) {
  console.error("CLI expected lint failure status when --lint is enabled");
  process.exit(1);
}

let lintParsed;
try {
  lintParsed = JSON.parse((lintCli.stderr ?? "").trim());
} catch {
  console.error("CLI did not emit valid JSON diagnostics for lint failure");
  console.error(lintCli.stderr);
  process.exit(1);
}

if (lintParsed.code !== "E_LINT_UNUSED_BINDING") {
  console.error(
    `Expected lint diagnostic code E_LINT_UNUSED_BINDING, got ${lintParsed.code}`,
  );
  process.exit(1);
}

for (const key of ["source", "cause", "reason", "fix"]) {
  if (!lintParsed[key] || typeof lintParsed[key] !== "string") {
    console.error(
      `Expected lint CLI diagnostic field '${key}' to be a non-empty string`,
    );
    process.exit(1);
  }
}

// 4) Receiver-call syntax for extern `this` parameter + lint suggestion.
const receiverExtern = `extern fn str_length(this: *Str) : I32;`;

const receiverOk = compileSourceResult(
  `${receiverExtern}\nfn main() : I32 => "abc".str_length();`,
  "<receiver-syntax>",
  {
    backend: "stage0",
    lint: { enabled: true },
  },
);
if (!receiverOk.ok) {
  console.error(
    `Expected receiver-call syntax to compile/lint cleanly, got: ${String(unwrapErr(receiverOk))}`,
  );
  process.exit(1);
}

const receiverLint = compileSourceResult(
  `${receiverExtern}\nfn main() : I32 => str_length("abc");`,
  "<receiver-lint>",
  {
    backend: "stage0",
    lint: { enabled: true },
  },
);
if (receiverLint.ok) {
  console.error("Expected lint failure for free-function receiver extern call");
  process.exit(1);
}
const receiverLintDiag = toDiagnostic(unwrapErr(receiverLint));
if (receiverLintDiag.code !== "E_LINT_PREFER_RECEIVER_CALL") {
  console.error(
    `Expected E_LINT_PREFER_RECEIVER_CALL, got ${receiverLintDiag.code}`,
  );
  process.exit(1);
}

// 5) Ensure lint autofix rewrites receiver-style extern calls in source.
const lintFixFile = path.join(outDir, "cli-lint-fix.tuff");
fs.writeFileSync(
  lintFixFile,
  [
    "extern fn str_length(this: *Str) : I32;",
    'fn main() : I32 => str_length("abcd");',
    "",
  ].join("\n"),
  "utf8",
);

const lintFixCli = spawnSync(
  process.execPath,
  [
    tsxCli,
    "./src/main/js/cli.ts",
    "compile",
    lintFixFile,
    "--lint",
    "--lint-fix",
    "-o",
    path.join(outDir, "cli-lint-fix.js"),
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (lintFixCli.status !== 0) {
  console.error("CLI lint-fix command failed unexpectedly");
  console.error(lintFixCli.stderr);
  process.exit(1);
}

const lintFixUpdated = fs.readFileSync(lintFixFile, "utf8");
if (!lintFixUpdated.includes('"abcd".str_length()')) {
  console.error(
    "Expected lint-fix to rewrite str_length call to receiver syntax",
  );
  console.error(lintFixUpdated);
  process.exit(1);
}
if (lintFixUpdated.includes('str_length("abcd")')) {
  console.error(
    "Expected lint-fix to remove free-function receiver call usage",
  );
  console.error(lintFixUpdated);
  process.exit(1);
}

// 6) Generic extern type declarations should parse/compile.
const externTypeResult = compileSourceResult(
  [
    "extern type Vec<T>;",
    "extern fn vec_new() : Vec<T>;",
    "extern fn vec_push(this: Vec<T>, item: T) : Vec<T>;",
    "fn main() : I32 => 0;",
    "",
  ].join("\n"),
  "<extern-type-generics>",
);
if (!externTypeResult.ok) {
  console.error(
    `Expected generic extern type declarations to compile, got: ${String(unwrapErr(externTypeResult))}`,
  );
  process.exit(1);
}

// 7) Effective-line lint should enforce <=500 non-comment/non-whitespace lines.
const longEffectiveLinesSource = [
  ...Array.from({ length: 501 }, (_, i) => `fn f${i}() : I32 => ${i};`),
  "fn main() : I32 => f0();",
  "",
].join("\n");

const lintTooLong = compileSourceResult(
  longEffectiveLinesSource,
  "<lint-file-too-long>",
  {
    backend: "stage0",
    lint: { enabled: true },
  },
);
if (lintTooLong.ok) {
  console.error("Expected file-length lint failure for >500 effective lines");
  process.exit(1);
}
const lintTooLongDiag = toDiagnostic(unwrapErr(lintTooLong));
if (lintTooLongDiag.code !== "E_LINT_FILE_TOO_LONG") {
  console.error(`Expected E_LINT_FILE_TOO_LONG, got ${lintTooLongDiag.code}`);
  process.exit(1);
}

const lintTooLongSelfhost = compileSourceResult(
  longEffectiveLinesSource,
  "<lint-file-too-long-selfhost>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (lintTooLongSelfhost.ok) {
  console.error(
    "Expected selfhost strict lint failure for >500 effective lines",
  );
  process.exit(1);
}
const lintTooLongSelfhostDiag = toDiagnostic(unwrapErr(lintTooLongSelfhost));
if (lintTooLongSelfhostDiag.code !== "E_LINT_FILE_TOO_LONG") {
  console.error(
    `Expected E_LINT_FILE_TOO_LONG (selfhost), got ${lintTooLongSelfhostDiag.code}`,
  );
  process.exit(1);
}

const mostlyCommentsSource = [
  ...Array.from({ length: 800 }, () => "// comment only"),
  "",
  "fn main() : I32 => 0;",
  "",
].join("\n");

const commentsSourceResult = compileSourceResult(
  mostlyCommentsSource,
  "<lint-file-comments>",
  {
    backend: "stage0",
    lint: { enabled: true },
  },
);
if (!commentsSourceResult.ok) {
  console.error(
    `Expected comment-only/blank lines to be excluded from line-count lint, got: ${String(unwrapErr(commentsSourceResult))}`,
  );
  process.exit(1);
}

// 8) Strict module-mode resolve should reject implicit cross-module references.
const strictModuleDir = path.join(outDir, "strict-modules");
fs.mkdirSync(strictModuleDir, { recursive: true });

const exportedModule = path.join(strictModuleDir, "defs.tuff");
const implicitConsumerModule = path.join(strictModuleDir, "app_implicit.tuff");
const explicitConsumerModule = path.join(strictModuleDir, "app_explicit.tuff");

fs.writeFileSync(
  exportedModule,
  [
    "out fn exported_value() : I32 => 7;",
    "out fn other_value() : I32 => 11;",
    "",
  ].join("\n"),
  "utf8",
);
fs.writeFileSync(
  implicitConsumerModule,
  [
    "let { exported_value } = defs;",
    "fn helper() : I32 => other_value();",
    "",
  ].join("\n"),
  "utf8",
);
fs.writeFileSync(
  explicitConsumerModule,
  [
    "let { exported_value, other_value } = defs;",
    "fn helper() : I32 => other_value();",
    "",
  ].join("\n"),
  "utf8",
);

const implicitResult = compileFileResult(implicitConsumerModule, undefined, {
  enableModules: true,
  modules: { moduleBaseDir: strictModuleDir },
});
if (implicitResult.ok) {
  console.error(
    "Expected strict module import failure for implicit cross-module symbol usage",
  );
  process.exit(1);
}
const implicitDiag = toDiagnostic(unwrapErr(implicitResult));
if (implicitDiag.code !== "E_MODULE_IMPLICIT_IMPORT") {
  console.error(`Expected E_MODULE_IMPLICIT_IMPORT, got ${implicitDiag.code}`);
  process.exit(1);
}

const implicitSelfhostNoBridge = compileFileResult(
  implicitConsumerModule,
  undefined,
  {
    backend: "selfhost",
    enableModules: true,
    modules: { moduleBaseDir: strictModuleDir },
    borrowcheck: { enabled: false },
  },
);
if (implicitSelfhostNoBridge.ok) {
  console.error(
    "Expected selfhost native strict module import failure without Stage0 borrow precheck",
  );
  process.exit(1);
}
const implicitSelfhostNoBridgeDiag = toDiagnostic(
  unwrapErr(implicitSelfhostNoBridge),
);
if (implicitSelfhostNoBridgeDiag.code !== "E_MODULE_IMPLICIT_IMPORT") {
  console.error(
    `Expected E_MODULE_IMPLICIT_IMPORT (selfhost native), got ${implicitSelfhostNoBridgeDiag.code}`,
  );
  process.exit(1);
}

const explicitResult = compileFileResult(explicitConsumerModule, undefined, {
  enableModules: true,
  modules: { moduleBaseDir: strictModuleDir },
});
if (!explicitResult.ok) {
  console.error(
    `Expected explicit let-binding import to satisfy strict module resolve, got: ${String(unwrapErr(explicitResult))}`,
  );
  process.exit(1);
}

// 9) Circular module imports should surface as lint warnings in warn mode.
const cycleLintDir = path.join(outDir, "lint-cycle-modules");
fs.mkdirSync(cycleLintDir, { recursive: true });

const cycleLintA = path.join(cycleLintDir, "A.tuff");
const cycleLintB = path.join(cycleLintDir, "B.tuff");

fs.writeFileSync(
  cycleLintA,
  [
    "let { b } = B;",
    "out fn a() : I32 => b();",
    "fn main() : I32 => a();",
    "",
  ].join("\n"),
  "utf8",
);
fs.writeFileSync(
  cycleLintB,
  ["let { a } = A;", "out fn b() : I32 => a();", ""].join("\n"),
  "utf8",
);

const cycleLintWarn = compileFileResult(cycleLintA, undefined, {
  backend: "stage0",
  enableModules: true,
  modules: { moduleBaseDir: cycleLintDir },
  lint: { enabled: true, mode: "warn" },
});
if (!cycleLintWarn.ok) {
  console.error(
    `Expected lint warn mode to compile with circular import warning, got: ${String(unwrapErr(cycleLintWarn))}`,
  );
  process.exit(1);
}

const cycleLintIssues = cycleLintWarn.value?.lintIssues ?? [];
const hasCircularLint = cycleLintIssues.some(
  (issue) => toDiagnostic(issue).code === "E_LINT_CIRCULAR_IMPORT",
);
if (!hasCircularLint) {
  console.error(
    "Expected circular import lint issue E_LINT_CIRCULAR_IMPORT in lint warn mode",
  );
  process.exit(1);
}

const cycleNoLint = compileFileResult(cycleLintA, undefined, {
  enableModules: true,
  modules: { moduleBaseDir: cycleLintDir },
});
if (cycleNoLint.ok) {
  console.error(
    "Expected module cycle to remain a hard compile error when lint warn mode is not enabled",
  );
  process.exit(1);
}
const cycleNoLintDiag = toDiagnostic(unwrapErr(cycleNoLint));
if (cycleNoLintDiag.code !== "E_MODULE_CYCLE") {
  console.error(
    `Expected E_MODULE_CYCLE without lint warn mode, got ${cycleNoLintDiag.code}`,
  );
  process.exit(1);
}

console.log("Phase 4 production diagnostics checks passed");
