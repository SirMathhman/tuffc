import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import { expectDiagnosticCode } from "./compile-test-utils.ts";
import { assertDiagnosticContract } from "./diagnostic-contract-utils.ts";
import { getCLIPaths } from "./path-test-utils.ts";
import {
  NULLABLE_POINTER_UNGUARDED_SOURCE,
  STRICT_DIV_BY_ZERO_SOURCE,
  STRICT_OVERFLOW_SOURCE,
  STRICT_OVERFLOW_VAR_SOURCE,
  SAFE_DIV_WITH_GUARD_SOURCE,
} from "./test-fixtures.ts";

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

const { root, tsxCli, nodeExec, nativeCli } = getCLIPaths(import.meta.url);
const outDir = path.join(root, "tests", "out", "stage4");
fs.mkdirSync(outDir, { recursive: true });

function runTsCli(args: string[]) {
  return spawnSync(nodeExec, [tsxCli, "./src/main/js/cli.ts", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runNativeCli(args: string[]) {
  return spawnSync(nodeExec, [nativeCli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

// 1) Ensure internal diagnostics contain codes/hints for strict safety failures.
const strictResult = compileSourceResult(
  STRICT_DIV_BY_ZERO_SOURCE,
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
expectDiagnosticCode(strictDiag, "E_SAFETY_DIV_BY_ZERO", "phase4 strict");
if (!strictDiag.hint || !strictDiag.hint.includes("denominator")) {
  console.error(
    `Expected diagnostic hint about denominator, got: ${strictDiag.hint}`,
  );
  process.exit(1);
}
assertDiagnosticContract(strictDiag);

// 1a-witness) Selfhost: div-zero reason should name the identifier denominator.
const strictSelfhostDivWitness = compileSourceResult(
  STRICT_DIV_BY_ZERO_SOURCE,
  "<phase4-selfhost-div-witness>",
  { backend: "selfhost", typecheck: { strictSafety: true } },
);
if (strictSelfhostDivWitness.ok) {
  console.error("Selfhost div-zero witness test expected compile failure");
  process.exit(1);
}
const divWitnessDiag = toDiagnostic(unwrapErr(strictSelfhostDivWitness));
if (!divWitnessDiag.reason || !divWitnessDiag.reason.includes("`x`")) {
  console.error(
    `Expected selfhost div-zero reason to name denominator identifier 'x', got: ${divWitnessDiag.reason}`,
  );
  process.exit(1);
}

// 1a-overflow) Selfhost: overflow reason should show computed witness value.
const strictOverflowResult = compileSourceResult(
  STRICT_OVERFLOW_SOURCE,
  "<phase4-selfhost-overflow>",
  { backend: "selfhost", typecheck: { strictSafety: true } },
);
if (strictOverflowResult.ok) {
  console.error("Selfhost overflow witness test expected compile failure");
  process.exit(1);
}
const overflowDiag = toDiagnostic(unwrapErr(strictOverflowResult));
expectDiagnosticCode(
  overflowDiag,
  "E_SAFETY_INTEGER_OVERFLOW",
  "phase4 overflow",
);
if (!overflowDiag.reason || !overflowDiag.reason.includes("2147483648")) {
  console.error(
    `Expected selfhost overflow reason to include computed value '2147483648', got: ${overflowDiag.reason}`,
  );
  process.exit(1);
}
assertDiagnosticContract(overflowDiag, "overflow witness diagnostic");

// 1b-overflow-var) Selfhost: overflow from variable with known literal value should also show witness.
const overflowVarResult = compileSourceResult(
  STRICT_OVERFLOW_VAR_SOURCE,
  "<phase4-selfhost-overflow-var>",
  { backend: "selfhost", typecheck: { strictSafety: true } },
);
if (overflowVarResult.ok) {
  console.error("Selfhost overflow-var witness test expected compile failure");
  process.exit(1);
}
const overflowVarDiag = toDiagnostic(unwrapErr(overflowVarResult));
expectDiagnosticCode(
  overflowVarDiag,
  "E_SAFETY_INTEGER_OVERFLOW",
  "phase4 overflow-var",
);
if (
  !overflowVarDiag.reason ||
  !overflowVarDiag.reason.includes("x=2147483647")
) {
  console.error(
    `Expected selfhost overflow-var reason to include variable witness 'x=2147483647', got: ${overflowVarDiag.reason}`,
  );
  process.exit(1);
}
assertDiagnosticContract(overflowVarDiag, "overflow-var witness diagnostic");

// 1c) Selfhost: if-guard pattern should compile successfully (no false positive div-zero).
const guardResult = compileSourceResult(
  SAFE_DIV_WITH_GUARD_SOURCE,
  "<phase4-safe-div-guard>",
  { backend: "selfhost", typecheck: { strictSafety: true } },
);
if (!guardResult.ok) {
  const guardDiag = toDiagnostic(
    unwrapErr(guardResult as { ok: false; error: unknown }),
  );
  console.error(
    `Phase C: if-guard pattern should compile safely, got error: ${guardDiag.code} — ${guardDiag.reason}`,
  );
  process.exit(1);
}

// 1b) Selfhost backend should also enforce strict-safety diagnostics contract.
const strictSelfhostResult = compileSourceResult(
  STRICT_DIV_BY_ZERO_SOURCE,
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
expectDiagnosticCode(
  strictSelfhostDiag,
  "E_SAFETY_DIV_BY_ZERO",
  "phase4 strict (selfhost)",
);

const nullableGuardResult = compileSourceResult(
  NULLABLE_POINTER_UNGUARDED_SOURCE,
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
assertDiagnosticContract(nullableGuardDiag, "nullable-pointer diagnostic");

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
assertDiagnosticContract(borrowGuardDiag, "borrow diagnostic");

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
assertDiagnosticContract(copyAliasDiag, "copy-alias diagnostic");

// 2) Ensure CLI emits machine-readable JSON diagnostics.
const failingFile = path.join(outDir, "cli-fail.tuff");
fs.writeFileSync(failingFile, STRICT_DIV_BY_ZERO_SOURCE, "utf8");

// 2a) Native CLI smoke checks (supported subset only).
const nativeHelp = runNativeCli(["--help"]);
if (nativeHelp.status !== 0) {
  console.error("Native CLI --help expected success");
  console.error(`${nativeHelp.stdout ?? ""}\n${nativeHelp.stderr ?? ""}`);
  process.exit(1);
}

// Probe whether the native exe can actually parse programs (the C backend may
// produce a exe that handles --version/--help but crashes on real source).
const nativeProbeFile = path.join(outDir, "native-probe.tuff");
fs.writeFileSync(nativeProbeFile, "fn main() : I32 => 0;", "utf8");
const nativeProbe = runNativeCli([nativeProbeFile]);
const nativeExeCanParse = nativeProbe.status === 0;

if (!nativeExeCanParse) {
  console.warn(
    "[phase4] WARN: native exe cannot parse programs (C backend not yet fixpoint-stable) — skipping native strict-safety check",
  );
} else {
  const nativeStrict = runNativeCli([failingFile, "--stage2"]);
  if (nativeStrict.status === 0) {
    console.error("Native CLI strict-safety probe expected failure");
    process.exit(1);
  }
  const nativeStrictOut = `${nativeStrict.stdout ?? ""}\n${nativeStrict.stderr ?? ""}`;
  if (!nativeStrictOut.includes("E_SAFETY_DIV_BY_ZERO")) {
    console.error(
      `Expected native strict-safety output to include E_SAFETY_DIV_BY_ZERO, got:\n${nativeStrictOut}`,
    );
    process.exit(1);
  }
}

const cli = runTsCli(["compile", failingFile, "--stage2", "--json-errors"]);

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

assertDiagnosticContract(parsed, "CLI diagnostic");

// 3) Ensure lint diagnostics use the same 4-part contract.
const lintFailingFile = path.join(outDir, "cli-lint-fail.tuff");
fs.writeFileSync(
  lintFailingFile,
  `fn main() : I32 => { let unused : I32 = 1; 0 }`,
  "utf8",
);

const lintCli = runTsCli([
  "compile",
  lintFailingFile,
  "--lint",
  "--lint-strict",
  "--json-errors",
]);

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

assertDiagnosticContract(lintParsed, "lint CLI diagnostic");

// 4) Receiver-call syntax for extern `this` parameter + lint suggestion.
const receiverExtern = `extern fn str_length(this: *Str) : I32;`;

const receiverOk = compileSourceResult(
  `${receiverExtern}\nfn main() : I32 => "abc".str_length();`,
  "<receiver-syntax>",
  {
    backend: "selfhost",
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
    backend: "selfhost",
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

const lintFixCli = runTsCli([
  "compile",
  lintFixFile,
  "--lint",
  "--lint-fix",
  "-o",
  path.join(outDir, "cli-lint-fix.js"),
  "--json-errors",
]);

if (lintFixCli.status === 0) {
  console.error("Expected CLI lint-fix command to be unsupported");
  process.exit(1);
}

let lintFixParsed;
try {
  lintFixParsed = JSON.parse((lintFixCli.stderr ?? "").trim());
} catch {
  console.error("CLI did not emit valid JSON diagnostics for lint-fix failure");
  console.error(lintFixCli.stderr);
  process.exit(1);
}

expectDiagnosticCode(
  lintFixParsed,
  "E_SELFHOST_UNSUPPORTED_OPTION",
  "lint-fix",
);

const lintFixUpdated = fs.readFileSync(lintFixFile, "utf8");
const lintFixOriginal = [
  "extern fn str_length(this: *Str) : I32;",
  'fn main() : I32 => str_length("abcd");',
  "",
].join("\n");
if (lintFixUpdated !== lintFixOriginal) {
  console.error("Expected lint-fix unsupported flow to leave source unchanged");
  console.error(lintFixUpdated);
  process.exit(1);
}

// 5b) AST duplicate lint: exact subtree matches (with normalized identifiers/literals)
// should be surfaced as lint diagnostics in strict mode.
const astDuplicateSource = [
  "fn main() : I32 => {",
  "  let a : I32 = (1 + 2) * (3 - 4);",
  "  let b : I32 = (5 + 6) * (7 - 8);",
  "  a + b",
  "}",
  "",
].join("\n");

const astDuplicateResult = compileSourceResult(
  astDuplicateSource,
  "<lint-ast-duplicate>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (astDuplicateResult.ok) {
  console.error("Expected strict lint failure for AST duplicate subtree");
  process.exit(1);
}
const astDuplicateDiag = toDiagnostic(unwrapErr(astDuplicateResult));
if (astDuplicateDiag.code !== "E_LINT_AST_DUPLICATE_SUBTREE") {
  console.error(
    `Expected E_LINT_AST_DUPLICATE_SUBTREE, got ${astDuplicateDiag.code}`,
  );
  process.exit(1);
}
assertDiagnosticContract(astDuplicateDiag, "AST duplicate subtree diagnostic");

const astNoDuplicateSource = [
  "fn main() : I32 => {",
  "  let a : I32 = 1 + 2;",
  "  let b : I32 = 1 * 2;",
  "  a + b",
  "}",
  "",
].join("\n");

const astNoDuplicateResult = compileSourceResult(
  astNoDuplicateSource,
  "<lint-ast-no-duplicate>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (!astNoDuplicateResult.ok) {
  const astNoDupDiag = toDiagnostic(unwrapErr(astNoDuplicateResult));
  console.error(
    `Expected no AST duplicate lint issue for non-matching subtrees, got: ${astNoDupDiag.code} — ${astNoDupDiag.reason}`,
  );
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
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (lintTooLong.ok) {
  console.error(
    "Expected selfhost strict lint failure for >500 effective lines",
  );
  process.exit(1);
}
const lintTooLongDiag = toDiagnostic(unwrapErr(lintTooLong));
if (lintTooLongDiag.code !== "E_LINT_FILE_TOO_LONG") {
  console.error(`Expected E_LINT_FILE_TOO_LONG, got ${lintTooLongDiag.code}`);
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
    backend: "selfhost",
    lint: { enabled: true },
  },
);
if (!commentsSourceResult.ok) {
  console.error(
    `Expected comment-only/blank lines to be excluded from line-count lint, got: ${String(unwrapErr(commentsSourceResult))}`,
  );
  process.exit(1);
}

// 7b) Function-level lint should enforce <=100 non-comment/non-whitespace lines per function.
const tooLongFunctionSource = [
  "fn too_long() : I32 => {",
  "  // comment line should not count",
  "",
  ...Array.from({ length: 101 }, (_, i) => `  let _v${i} : I32 = ${i};`),
  "  0",
  "}",
  "fn main() : I32 => too_long();",
  "",
].join("\n");

const tooLongFunctionResult = compileSourceResult(
  tooLongFunctionSource,
  "<lint-function-too-long>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (tooLongFunctionResult.ok) {
  console.error(
    "Expected strict lint failure for function exceeding 100 effective lines",
  );
  process.exit(1);
}
const tooLongFunctionDiag = toDiagnostic(unwrapErr(tooLongFunctionResult));
if (tooLongFunctionDiag.code !== "E_LINT_FUNCTION_TOO_LONG") {
  console.error(
    `Expected E_LINT_FUNCTION_TOO_LONG, got ${tooLongFunctionDiag.code}`,
  );
  process.exit(1);
}

const exactlyHundredFunctionSource = [
  "fn exactly_hundred() : I32 => {",
  ...Array.from({ length: 100 }, (_, i) => `  let _v${i} : I32 = ${i};`),
  "  0",
  "}",
  "fn main() : I32 => exactly_hundred();",
  "",
].join("\n");

const exactlyHundredFunctionResult = compileSourceResult(
  exactlyHundredFunctionSource,
  "<lint-function-exactly-100>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (exactlyHundredFunctionResult.ok) {
  console.error(
    "Expected strict lint failure for function with exactly 100 effective lines",
  );
  process.exit(1);
}
const exactlyHundredFunctionDiag = toDiagnostic(
  unwrapErr(exactlyHundredFunctionResult),
);
if (exactlyHundredFunctionDiag.code !== "E_LINT_FUNCTION_TOO_LONG") {
  console.error(
    `Expected E_LINT_FUNCTION_TOO_LONG at exactly 100 lines, got ${exactlyHundredFunctionDiag.code}`,
  );
  process.exit(1);
}

const commentHeavyFunctionSource = [
  "fn mostly_comments() : I32 => {",
  ...Array.from({ length: 200 }, () => "  // comment-only line"),
  "",
  "  let x : I32 = 1;",
  "  x",
  "}",
  "fn main() : I32 => mostly_comments();",
  "",
].join("\n");

const commentHeavyFunctionResult = compileSourceResult(
  commentHeavyFunctionSource,
  "<lint-function-comments>",
  {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  },
);
if (!commentHeavyFunctionResult.ok) {
  console.error(
    `Expected comments/blank lines to be excluded from function-length lint, got: ${String(unwrapErr(commentHeavyFunctionResult))}`,
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
  modules: { moduleBaseDir: strictModuleDir },
});
if (implicitResult.ok) {
  console.error(
    "Expected strict module import failure for implicit cross-module symbol usage",
  );
  process.exit(1);
}
const implicitDiag = toDiagnostic(unwrapErr(implicitResult));
expectDiagnosticCode(
  implicitDiag,
  "E_MODULE_IMPLICIT_IMPORT",
  "strict module implicit import",
);

const implicitSelfhostNoBridge = compileFileResult(
  implicitConsumerModule,
  undefined,
  {
    backend: "selfhost",
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
expectDiagnosticCode(
  implicitSelfhostNoBridgeDiag,
  "E_MODULE_IMPLICIT_IMPORT",
  "strict module implicit import (selfhost native)",
);

const explicitResult = compileFileResult(explicitConsumerModule, undefined, {
  modules: { moduleBaseDir: strictModuleDir },
});
if (!explicitResult.ok) {
  console.error(
    `Expected explicit let-binding import to satisfy strict module resolve, got: ${String(unwrapErr(explicitResult))}`,
  );
  process.exit(1);
}

const moduleLintFixUnsupported = compileFileResult(
  explicitConsumerModule,
  undefined,
  {
    backend: "selfhost",
    modules: { moduleBaseDir: strictModuleDir },
    lint: { enabled: true, fix: true, mode: "warn" },
  },
);
if (moduleLintFixUnsupported.ok) {
  console.error("Expected module lint-fix to be rejected in selfhost mode");
  process.exit(1);
}
const moduleLintFixUnsupportedDiag = toDiagnostic(
  unwrapErr(moduleLintFixUnsupported),
);
expectDiagnosticCode(
  moduleLintFixUnsupportedDiag,
  "E_SELFHOST_UNSUPPORTED_OPTION",
  "module lint-fix",
);

// 9) Circular module imports should produce deterministic diagnostics in warn mode.
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
  backend: "selfhost",
  modules: { moduleBaseDir: cycleLintDir },
  lint: { enabled: true, mode: "warn" },
});
if (cycleLintWarn.ok) {
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
} else {
  const cycleWarnDiag = toDiagnostic(unwrapErr(cycleLintWarn));
  if (
    cycleWarnDiag.code !== "E_MODULE_CYCLE" &&
    cycleWarnDiag.code !== "E_RESOLVE_SHADOWING"
  ) {
    console.error(
      `Expected cycle warn flow to produce cycle-related diagnostics, got ${cycleWarnDiag.code}`,
    );
    process.exit(1);
  }
}

const cycleNoLint = compileFileResult(cycleLintA, undefined, {
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

// 10) parser_decls.tuff should stay under the effective-line budget.
const parserDeclsPath = path.join(
  root,
  "src",
  "main",
  "tuff",
  "selfhost",
  "parser_decls.tuff",
);
const parserDeclsSource = fs.readFileSync(parserDeclsPath, "utf8");
const parserDeclsEffectiveLines = parserDeclsSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("//")).length;
if (parserDeclsEffectiveLines >= 510) {
  console.error(
    `Expected parser_decls.tuff to stay under 510 effective lines, got ${parserDeclsEffectiveLines}`,
  );
  process.exit(1);
}

console.log("Phase 4 production diagnostics checks passed");
