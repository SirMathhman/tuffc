// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import * as runtime from "../../main/js/runtime.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "selfhost", "parity");
const modulesBase = path.join(root, "src", "test", "tuff", "modules");
const moduleEntry = path.join(modulesBase, "app.tuff");
const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");

fs.mkdirSync(outDir, { recursive: true });

function loadSelfhost() {
  const selfhostResult = compileFileResult(
    selfhostPath,
    path.join(outDir, "selfhost.js"),
    {
      enableModules: true,
      modules: { moduleBaseDir: path.dirname(selfhostPath) },
      resolve: {
        hostBuiltins: Object.keys(runtime),
        allowHostPrefix: "",
      },
    },
  );
  if (!selfhostResult.ok) throw selfhostResult.error;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  vm.runInNewContext(
    `${selfhostResult.value.js}\nmodule.exports = { compile_source, compile_file, main };`,
    sandbox,
  );

  const selfhost = sandbox.module.exports;
  if (
    typeof selfhost.compile_source !== "function" ||
    typeof selfhost.compile_file !== "function"
  ) {
    throw new Error("selfhost compiler exports are incomplete");
  }
  return selfhost;
}

function runMainFromJs(js, label) {
  const sandbox = { module: { exports: {} }, exports: {}, console };
  vm.runInNewContext(`${js}\nmodule.exports = { main };`, sandbox);
  if (typeof sandbox.module.exports.main !== "function") {
    throw new Error(`${label}: generated JS does not export main()`);
  }
  return sandbox.module.exports.main();
}

function assertContract(diag, label) {
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      throw new Error(
        `${label}: diagnostic field '${key}' must be a non-empty string`,
      );
    }
  }
}

function expectBothFail(
  jsResultFn,
  selfhostFn,
  label,
  expectedCode = undefined,
) {
  const jsResult = jsResultFn();
  let selfhostError = undefined;

  try {
    selfhostFn();
  } catch (error) {
    selfhostError = error;
  }

  if (jsResult.ok || !selfhostError) {
    throw new Error(`${label}: expected both compilers to fail`);
  }

  const jsDiag = toDiagnostic(jsResult.error);
  const selfhostDiag = toDiagnostic(selfhostError);
  assertContract(jsDiag, `${label} (js)`);
  assertContract(selfhostDiag, `${label} (selfhost)`);
  if (expectedCode) {
    if (jsDiag.code !== expectedCode) {
      throw new Error(
        `${label} (js): expected diagnostic code ${expectedCode}, got ${jsDiag.code}`,
      );
    }
    if (selfhostDiag.code !== expectedCode) {
      throw new Error(
        `${label} (selfhost): expected diagnostic code ${expectedCode}, got ${selfhostDiag.code}`,
      );
    }
  }
}

const selfhost = loadSelfhost();

// 1) Runtime parity on in-memory source.
const factorialSource = `
fn factorial(n: I32) : I32 => {
  if (n <= 1) { 1 } else { n * factorial(n - 1) }
}
fn main() : I32 => factorial(5);
`;

const jsFactorialResultObj = compileSourceResult(
  factorialSource,
  "<parity-factorial-js>",
);
if (!jsFactorialResultObj.ok) throw jsFactorialResultObj.error;
const jsFactorial = jsFactorialResultObj.value.js;
const selfhostFactorial = selfhost.compile_source(factorialSource);
const jsFactorialResult = runMainFromJs(jsFactorial, "js-factorial");
const selfhostFactorialResult = runMainFromJs(
  selfhostFactorial,
  "selfhost-factorial",
);
if (jsFactorialResult !== selfhostFactorialResult) {
  throw new Error(
    `factorial parity mismatch: js=${jsFactorialResult}, selfhost=${selfhostFactorialResult}`,
  );
}

const enumSource = `
enum Color { Red, Blue }
fn pick(c: Color) : I32 =>
  match (c) {
    case Red = 1;
    case Blue = 2;
  };
fn main() : I32 => pick(Color.Blue);
`;
const jsEnumResultObj = compileSourceResult(enumSource, "<parity-enum-js>");
if (!jsEnumResultObj.ok) throw jsEnumResultObj.error;
const jsEnum = jsEnumResultObj.value.js;
const selfhostEnum = selfhost.compile_source(enumSource);
const jsEnumResult = runMainFromJs(jsEnum, "js-enum");
const selfhostEnumResult = runMainFromJs(selfhostEnum, "selfhost-enum");
if (jsEnumResult !== selfhostEnumResult) {
  throw new Error(
    `enum parity mismatch: js=${jsEnumResult}, selfhost=${selfhostEnumResult}`,
  );
}

// 2) Module compile_file parity.
const jsModuleOut = path.join(outDir, "module-js.js");
const selfhostModuleOut = path.join(outDir, "module-selfhost.js");

const jsModule = compileFileResult(moduleEntry, jsModuleOut, {
  enableModules: true,
  modules: { moduleBaseDir: modulesBase },
});
if (!jsModule.ok) throw jsModule.error;
selfhost.compile_file(moduleEntry, selfhostModuleOut);

const jsModuleResult = runMainFromJs(jsModule.value.js, "js-module");
const selfhostModuleJs = fs.readFileSync(selfhostModuleOut, "utf8");
const selfhostModuleResult = runMainFromJs(selfhostModuleJs, "selfhost-module");
if (jsModuleResult !== selfhostModuleResult) {
  throw new Error(
    `module parity mismatch: js=${jsModuleResult}, selfhost=${selfhostModuleResult}`,
  );
}

// 3) Parse failure parity (both must fail with diagnostics contract).
expectBothFail(
  () => compileSourceResult("fn broken( : I32 => 0;", "<parity-bad-js>"),
  () => selfhost.compile_source("fn broken( : I32 => 0;"),
  "parse-failure parity",
);

// 4) Missing module failure parity (both must fail with diagnostics contract).
const missingEntry = path.join(outDir, "missing-module-entry.tuff");
const missingJsOut = path.join(outDir, "missing-module-js.js");
const missingSelfhostOut = path.join(outDir, "missing-module-selfhost.js");
fs.writeFileSync(
  missingEntry,
  "let { x } = com::meti::DefinitelyMissing;\nfn main() : I32 => x();\n",
  "utf8",
);

expectBothFail(
  () =>
    compileFileResult(missingEntry, missingJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: path.dirname(missingEntry) },
    }),
  () => selfhost.compile_file(missingEntry, missingSelfhostOut),
  "missing-module parity",
);

// 5) Module cycle failure parity (both must fail with diagnostics contract).
const cycleDir = path.join(outDir, "cycle");
const cycleA = path.join(cycleDir, "A.tuff");
const cycleB = path.join(cycleDir, "B.tuff");
const cycleJsOut = path.join(cycleDir, "cycle-js.js");
const cycleSelfhostOut = path.join(cycleDir, "cycle-selfhost.js");
fs.mkdirSync(cycleDir, { recursive: true });
fs.writeFileSync(cycleA, "let { b } = B;\nfn a() : I32 => b();\n", "utf8");
fs.writeFileSync(cycleB, "let { a } = A;\nfn b() : I32 => a();\n", "utf8");

expectBothFail(
  () =>
    compileFileResult(cycleA, cycleJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: cycleDir },
    }),
  () => selfhost.compile_file(cycleA, cycleSelfhostOut),
  "module-cycle parity",
  "E_MODULE_CYCLE",
);

// 6) Unknown identifier failure parity.
expectBothFail(
  () =>
    compileSourceResult(
      "fn main() : I32 => missing_symbol;",
      "<unknown-id-js>",
    ),
  () => selfhost.compile_source("fn main() : I32 => missing_symbol;"),
  "unknown-identifier parity",
  "E_RESOLVE_UNKNOWN_IDENTIFIER",
);

// 7) Duplicate global declaration parity.
const dupSource = `
fn collide() : I32 => 1;
fn collide() : I32 => 2;
fn main() : I32 => collide();
`;

expectBothFail(
  () => compileSourceResult(dupSource, "<dup-global-js>"),
  () => selfhost.compile_source(dupSource),
  "duplicate-global parity",
  "E_RESOLVE_SHADOWING",
);

// 8) Function call arity mismatch parity (first type-semantics gate).
const aritySource = `
fn add(a: I32, b: I32) : I32 => a + b;
fn main() : I32 => add(1);
`;

expectBothFail(
  () => compileSourceResult(aritySource, "<arity-js>"),
  () => selfhost.compile_source(aritySource),
  "arity-mismatch parity",
);

// 8b) Function call argument type mismatch parity.
const argTypeMismatchSource = `
fn takes_i32(x: I32) : I32 => x;
fn main() : I32 => takes_i32(true);
`;

expectBothFail(
  () => compileSourceResult(argTypeMismatchSource, "<arg-type-js>"),
  () => selfhost.compile_source(argTypeMismatchSource),
  "arg-type-mismatch parity",
);

// 8c) Assignment mismatch parity.
const assignmentMismatchSource = `
fn main() : I32 => {
  let x : I32 = 1;
  x = true;
  x
}
`;

expectBothFail(
  () => compileSourceResult(assignmentMismatchSource, "<assign-type-js>"),
  () => selfhost.compile_source(assignmentMismatchSource),
  "assignment-type-mismatch parity",
);

// 8d) Return mismatch parity.
const returnMismatchSource = `
fn bad() : I32 => {
  return true;
}
fn main() : I32 => bad();
`;

expectBothFail(
  () => compileSourceResult(returnMismatchSource, "<return-type-js>"),
  () => selfhost.compile_source(returnMismatchSource),
  "return-type-mismatch parity",
);

// 8e) if condition must be Bool parity.
const ifConditionSource = `
fn main() : I32 => {
  if (1) { 1 } else { 0 }
}
`;

expectBothFail(
  () => compileSourceResult(ifConditionSource, "<if-condition-js>"),
  () => selfhost.compile_source(ifConditionSource),
  "if-condition-bool parity",
);

// 9) Non-exported module import parity.
const privateDir = path.join(outDir, "private-import");
const privateLib = path.join(privateDir, "Lib.tuff");
const privateEntry = path.join(privateDir, "Main.tuff");
const privateJsOut = path.join(privateDir, "main-js.js");
const privateSelfhostOut = path.join(privateDir, "main-selfhost.js");
fs.mkdirSync(privateDir, { recursive: true });
fs.writeFileSync(
  privateLib,
  "fn hidden() : I32 => 1;\nout fn shown() : I32 => 2;\n",
  "utf8",
);
fs.writeFileSync(
  privateEntry,
  "let { hidden } = Lib;\nfn main() : I32 => hidden();\n",
  "utf8",
);

expectBothFail(
  () =>
    compileFileResult(privateEntry, privateJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: privateDir },
    }),
  () => selfhost.compile_file(privateEntry, privateSelfhostOut),
  "private-import parity",
  "E_MODULE_PRIVATE_IMPORT",
);

const nullableStrictSource = "fn bad(p : *I32 | 0USize) : I32 => p[0];\n";

const nullableStage0 = compileSourceResult(
  nullableStrictSource,
  "<nullable-stage0>",
  {
    typecheck: { strictSafety: true },
  },
);
const nullableSelfhostStrict = compileSourceResult(
  nullableStrictSource,
  "<nullable-selfhost>",
  {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  },
);
if (nullableStage0.ok || nullableSelfhostStrict.ok) {
  throw new Error(
    "nullable strict-safety parity: expected both backends to fail",
  );
}
const nullableStage0Diag = toDiagnostic(nullableStage0.error);
const nullableSelfhostDiag = toDiagnostic(nullableSelfhostStrict.error);
if (nullableStage0Diag.code !== "E_SAFETY_NULLABLE_POINTER_GUARD") {
  throw new Error(
    `nullable strict-safety parity (stage0): expected E_SAFETY_NULLABLE_POINTER_GUARD, got ${nullableStage0Diag.code}`,
  );
}
if (nullableSelfhostDiag.code !== "E_SAFETY_NULLABLE_POINTER_GUARD") {
  throw new Error(
    `nullable strict-safety parity (selfhost): expected E_SAFETY_NULLABLE_POINTER_GUARD, got ${nullableSelfhostDiag.code}`,
  );
}

const nullableGuardedSource =
  "fn ok(p : *I32 | 0USize) : I32 => { if (p != 0USize) { p[0] } else { 0 } }\n";
const nullableGuardedStage0 = compileSourceResult(
  nullableGuardedSource,
  "<nullable-guarded-stage0>",
  {
    typecheck: { strictSafety: true },
  },
);
const nullableGuardedSelfhost = compileSourceResult(
  nullableGuardedSource,
  "<nullable-guarded-selfhost>",
  {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  },
);
if (!nullableGuardedStage0.ok || !nullableGuardedSelfhost.ok) {
  throw new Error("nullable guarded parity: expected both backends to compile");
}

const moduloStrictSource = "fn bad_mod(x : I32) : I32 => 10 % x;\n";
const moduloStage0 = compileSourceResult(moduloStrictSource, "<mod-stage0>", {
  typecheck: { strictSafety: true },
});
const moduloSelfhostStrict = compileSourceResult(
  moduloStrictSource,
  "<mod-selfhost>",
  {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  },
);
if (moduloStage0.ok || moduloSelfhostStrict.ok) {
  throw new Error(
    "modulo strict-safety parity: expected both backends to fail",
  );
}
const moduloStage0Diag = toDiagnostic(moduloStage0.error);
const moduloSelfhostDiag = toDiagnostic(moduloSelfhostStrict.error);
if (moduloStage0Diag.code !== "E_SAFETY_MOD_BY_ZERO") {
  throw new Error(
    `modulo strict-safety parity (stage0): expected E_SAFETY_MOD_BY_ZERO, got ${moduloStage0Diag.code}`,
  );
}
if (moduloSelfhostDiag.code !== "E_SAFETY_MOD_BY_ZERO") {
  throw new Error(
    `modulo strict-safety parity (selfhost): expected E_SAFETY_MOD_BY_ZERO, got ${moduloSelfhostDiag.code}`,
  );
}

const overflowStrictSource = "fn overflow() : I32 => 2147483647 + 1;\n";
const overflowStage0 = compileSourceResult(
  overflowStrictSource,
  "<overflow-stage0>",
  {
    typecheck: { strictSafety: true },
  },
);
const overflowSelfhostStrict = compileSourceResult(
  overflowStrictSource,
  "<overflow-selfhost>",
  {
    backend: "selfhost",
    typecheck: { strictSafety: true },
  },
);
if (overflowStage0.ok || overflowSelfhostStrict.ok) {
  throw new Error(
    "overflow strict-safety parity: expected both backends to fail",
  );
}
const overflowStage0Diag = toDiagnostic(overflowStage0.error);
const overflowSelfhostDiag = toDiagnostic(overflowSelfhostStrict.error);
if (overflowStage0Diag.code !== "E_SAFETY_OVERFLOW") {
  throw new Error(
    `overflow strict-safety parity (stage0): expected E_SAFETY_OVERFLOW, got ${overflowStage0Diag.code}`,
  );
}
if (overflowSelfhostDiag.code !== "E_SAFETY_OVERFLOW") {
  throw new Error(
    `overflow strict-safety parity (selfhost): expected E_SAFETY_OVERFLOW, got ${overflowSelfhostDiag.code}`,
  );
}

const borrowMoveSource = `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let moved : Box = b;
  b.v
}
`;
const borrowMoveStage0 = compileSourceResult(
  borrowMoveSource,
  "<borrow-stage0>",
);
const borrowMoveSelfhost = compileSourceResult(
  borrowMoveSource,
  "<borrow-selfhost>",
  {
    backend: "selfhost",
  },
);
if (borrowMoveStage0.ok || borrowMoveSelfhost.ok) {
  throw new Error(
    "borrow parity: expected both backends to fail on use-after-move",
  );
}
if (toDiagnostic(borrowMoveStage0.error).code !== "E_BORROW_USE_AFTER_MOVE") {
  throw new Error("borrow parity (stage0): expected E_BORROW_USE_AFTER_MOVE");
}
if (toDiagnostic(borrowMoveSelfhost.error).code !== "E_BORROW_USE_AFTER_MOVE") {
  throw new Error("borrow parity (selfhost): expected E_BORROW_USE_AFTER_MOVE");
}

const borrowOkSource = `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let r : *Box = &b;
  0
}
`;
const borrowOkStage0 = compileSourceResult(
  borrowOkSource,
  "<borrow-ok-stage0>",
);
const borrowOkSelfhost = compileSourceResult(
  borrowOkSource,
  "<borrow-ok-selfhost>",
  {
    backend: "selfhost",
  },
);
if (!borrowOkStage0.ok || !borrowOkSelfhost.ok) {
  throw new Error(
    "borrow parity: expected both backends to compile borrow-only case",
  );
}

const copyStructSource = `
copy struct Vec2 { x : F32, y : F32 }
fn main() : I32 => {
  let a : Vec2 = Vec2 { x: 1, y: 2 };
  let b : Vec2 = a;
  let c : Vec2 = a;
  0
}
`;
const copyStructStage0 = compileSourceResult(copyStructSource, "<copy-struct-stage0>");
const copyStructSelfhost = compileSourceResult(copyStructSource, "<copy-struct-selfhost>", {
  backend: "selfhost",
});
if (!copyStructStage0.ok || !copyStructSelfhost.ok) {
  throw new Error("copy-struct parity: expected both backends to compile");
}

const copyAliasInvalidSource = `
struct Box { v : I32 }
copy type BoxAlias = Box;
fn main() : I32 => 0;
`;
expectBothFail(
  () => compileSourceResult(copyAliasInvalidSource, "<copy-alias-invalid-js>"),
  () => selfhost.compile_source(copyAliasInvalidSource),
  "copy-alias-invalid parity",
  "E_BORROW_INVALID_COPY_ALIAS",
);

console.log("Selfhost differential parity checks passed");
