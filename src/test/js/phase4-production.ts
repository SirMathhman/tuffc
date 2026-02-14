import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileFile, compileSource } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const outDir = path.join(root, "tests", "out", "stage4");
fs.mkdirSync(outDir, { recursive: true });

// 1) Ensure internal diagnostics contain codes/hints for strict safety failures.
try {
  compileSource(`fn bad(x : I32) : I32 => 100 / x;`, "<phase4>", {
    typecheck: { strictSafety: true },
  });
  console.error("Phase 4 diagnostics test expected strict compile failure");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_SAFETY_DIV_BY_ZERO") {
    console.error(`Expected E_SAFETY_DIV_BY_ZERO, got ${diag.code}`);
    process.exit(1);
  }
  if (!diag.hint || !diag.hint.includes("denominator")) {
    console.error(
      `Expected diagnostic hint about denominator, got: ${diag.hint}`,
    );
    process.exit(1);
  }
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      console.error(
        `Expected diagnostic field '${key}' to be a non-empty string`,
      );
      process.exit(1);
    }
  }
}

// 1b) Selfhost backend should also enforce strict-safety diagnostics contract.
try {
  compileSource(`fn bad(x : I32) : I32 => 100 / x;`, "<phase4-selfhost>", {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  });
  console.error("Selfhost strict-safety test expected compile failure");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_SAFETY_DIV_BY_ZERO") {
    console.error(`Expected E_SAFETY_DIV_BY_ZERO (selfhost), got ${diag.code}`);
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

try {
  compileSource(
    `${receiverExtern}\nfn main() : I32 => "abc".str_length();`,
    "<receiver-syntax>",
    {
      lint: { enabled: true },
    },
  );
} catch (error) {
  console.error(
    `Expected receiver-call syntax to compile/lint cleanly, got: ${error.message}`,
  );
  process.exit(1);
}

try {
  compileSource(
    `${receiverExtern}\nfn main() : I32 => str_length("abc");`,
    "<receiver-lint>",
    {
      lint: { enabled: true },
    },
  );
  console.error("Expected lint failure for free-function receiver extern call");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_LINT_PREFER_RECEIVER_CALL") {
    console.error(`Expected E_LINT_PREFER_RECEIVER_CALL, got ${diag.code}`);
    process.exit(1);
  }
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
try {
  compileSource(
    [
      "extern type Vec<T>;",
      "extern fn vec_new() : Vec<T>;",
      "extern fn vec_push(this: Vec<T>, item: T) : Vec<T>;",
      "fn main() : I32 => 0;",
      "",
    ].join("\n"),
    "<extern-type-generics>",
  );
} catch (error) {
  console.error(
    `Expected generic extern type declarations to compile, got: ${error.message}`,
  );
  process.exit(1);
}

// 7) Effective-line lint should enforce <=500 non-comment/non-whitespace lines.
const longEffectiveLinesSource = [
  ...Array.from({ length: 501 }, (_, i) => `fn f${i}() : I32 => ${i};`),
  "fn main() : I32 => f0();",
  "",
].join("\n");

try {
  compileSource(longEffectiveLinesSource, "<lint-file-too-long>", {
    lint: { enabled: true },
  });
  console.error("Expected file-length lint failure for >500 effective lines");
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_LINT_FILE_TOO_LONG") {
    console.error(`Expected E_LINT_FILE_TOO_LONG, got ${diag.code}`);
    process.exit(1);
  }
}

try {
  compileSource(longEffectiveLinesSource, "<lint-file-too-long-selfhost>", {
    backend: "selfhost",
    lint: { enabled: true, mode: "error" },
  });
  console.error(
    "Expected selfhost strict lint failure for >500 effective lines",
  );
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_LINT_FILE_TOO_LONG") {
    console.error(`Expected E_LINT_FILE_TOO_LONG (selfhost), got ${diag.code}`);
    process.exit(1);
  }
}

const mostlyCommentsSource = [
  ...Array.from({ length: 800 }, () => "// comment only"),
  "",
  "fn main() : I32 => 0;",
  "",
].join("\n");

try {
  compileSource(mostlyCommentsSource, "<lint-file-comments>", {
    lint: { enabled: true },
  });
} catch (error) {
  console.error(
    `Expected comment-only/blank lines to be excluded from line-count lint, got: ${error.message}`,
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

try {
  compileFile(implicitConsumerModule, null, {
    enableModules: true,
    modules: { moduleBaseDir: strictModuleDir },
  });
  console.error(
    "Expected strict module import failure for implicit cross-module symbol usage",
  );
  process.exit(1);
} catch (error) {
  const diag = toDiagnostic(error);
  if (diag.code !== "E_MODULE_IMPLICIT_IMPORT") {
    console.error(`Expected E_MODULE_IMPLICIT_IMPORT, got ${diag.code}`);
    process.exit(1);
  }
}

try {
  compileFile(explicitConsumerModule, null, {
    enableModules: true,
    modules: { moduleBaseDir: strictModuleDir },
  });
} catch (error) {
  console.error(
    `Expected explicit let-binding import to satisfy strict module resolve, got: ${error.message}`,
  );
  process.exit(1);
}

console.log("Phase 4 production diagnostics checks passed");
