// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import { compileAndLoadSelfhost } from "./selfhost-harness.ts";
import {
  COPY_ALIAS_INVALID_BOX_SOURCE,
  COPY_STRUCT_VEC2_PROGRAM,
  FACTORIAL_PROGRAM,
  makeImmutBorrowedBoxProgram,
  MOVE_AFTER_MOVE_BOX_SOURCE,
} from "./test-fixtures.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "selfhost", "parity");
const modulesBase = path.join(root, "src", "test", "tuff", "modules");
const moduleEntry = path.join(modulesBase, "app.tuff");

fs.mkdirSync(outDir, { recursive: true });

function loadSelfhost() {
  const { selfhost } = compileAndLoadSelfhost(root, outDir);
  if (
    typeof selfhost.compile_source !== "function" ||
    typeof selfhost.compile_file !== "function"
  ) {
    throw new Error("selfhost compiler exports are incomplete");
  }
  return selfhost;
}

function assertContract(diag, label) {
  const diagFields = ["source", "cause", "reason", "fix"];
  for (const key of diagFields) {
    if (!diag[key] || typeof diag[key] !== "string") {
      throw new Error(
        `${label}: diagnostic field '${key}' must be a non-empty string`,
      );
    }
  }
}

function assertDiagCode(diag, expectedCode, label) {
  if (diag.code !== expectedCode) {
    throw new Error(`${label}: expected ${expectedCode}, got ${diag.code}`);
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
    const diagCodeMsg = (be, actual) =>
      `${label} (${be}): expected diagnostic code ${expectedCode}, got ${actual}`;
    if (jsDiag.code !== expectedCode) {
      throw new Error(diagCodeMsg("js", jsDiag.code));
    }
    if (selfhostDiag.code !== expectedCode) {
      throw new Error(diagCodeMsg("selfhost", selfhostDiag.code));
    }
  }
}

const selfhost = loadSelfhost();

// 1) Runtime parity on in-memory source.
const factorialSource = FACTORIAL_PROGRAM;

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

const lifetimeSource = [
  "fn main() : I32 => {",
  "  let x : I32 = 41;",
  "  lifetime t {",
  "    let y : I32 = x + 1;",
  "  }",
  "  x + 1",
  "}",
  "",
].join("\n");
const lifetimeStage0 = compileSourceResult(
  lifetimeSource,
  "<lifetime-stage0>",
  {
    backend: "selfhost",
  },
);
const lifetimeSelfhost = compileSourceResult(
  lifetimeSource,
  "<lifetime-selfhost>",
  {
    backend: "selfhost",
  },
);
if (!lifetimeStage0.ok || !lifetimeSelfhost.ok) {
  throw new Error("lifetime keyword parity: expected both backends to compile");
}

const lifetimesIdentifierSource = [
  "fn lifetimes(v : I32) : I32 => v + 1;",
  "fn main() : I32 => lifetimes(41);",
  "",
].join("\n");
const lifetimesIdentifierStage0 = compileSourceResult(
  lifetimesIdentifierSource,
  "<lifetimes-ident-stage0>",
  { backend: "selfhost" },
);
const lifetimesIdentifierSelfhost = compileSourceResult(
  lifetimesIdentifierSource,
  "<lifetimes-ident-selfhost>",
  { backend: "selfhost" },
);
if (!lifetimesIdentifierStage0.ok || !lifetimesIdentifierSelfhost.ok) {
  throw new Error(
    "lifetimes identifier parity: expected both backends to treat it as identifier",
  );
}

expectBothFail(
  () =>
    compileSourceResult(
      [
        "fn main() : I32 => {",
        "  lifetime {",
        "    1;",
        "  }",
        "  0",
        "}",
        "",
      ].join("\n"),
      "<lifetime-missing-binder-stage0>",
      { backend: "selfhost" },
    ),
  () =>
    selfhost.compile_source(
      [
        "fn main() : I32 => {",
        "  lifetime {",
        "    1;",
        "  }",
        "  0",
        "}",
        "",
      ].join("\n"),
    ),
  "lifetime-missing-binder parity",
);

const lifetimeMultiBinderSource = [
  "fn main() : I32 => {",
  "  let x : I32 = 1;",
  "  let y : I32 = 2;",
  "  lifetime a, b {",
  "    let p : *a I32 = &x;",
  "    let q : *b mut I32 = &mut y;",
  "  }",
  "  x",
  "}",
  "",
].join("\n");
const lifetimeMultiStage0 = compileSourceResult(
  lifetimeMultiBinderSource,
  "<lifetime-multi-stage0>",
  { backend: "selfhost" },
);
const lifetimeMultiSelfhost = compileSourceResult(
  lifetimeMultiBinderSource,
  "<lifetime-multi-selfhost>",
  { backend: "selfhost" },
);
if (!lifetimeMultiStage0.ok || !lifetimeMultiSelfhost.ok) {
  throw new Error(
    "lifetime multi-binder parity: expected both backends to compile",
  );
}

expectBothFail(
  () =>
    compileSourceResult(
      [
        "fn main() : I32 => {",
        "  let x : I32 = 1;",
        "  let p : *a I32 = &x;",
        "  x",
        "}",
        "",
      ].join("\n"),
      "<lifetime-undefined-stage0>",
      { backend: "selfhost" },
    ),
  () =>
    selfhost.compile_source(
      [
        "fn main() : I32 => {",
        "  let x : I32 = 1;",
        "  let p : *a I32 = &x;",
        "  x",
        "}",
        "",
      ].join("\n"),
    ),
  "lifetime-undefined parity",
  "E_RESOLVE_UNDEFINED_LIFETIME",
);

expectBothFail(
  () =>
    compileSourceResult(
      [
        "fn main() : I32 => {",
        "  lifetime a, a {",
        "    1;",
        "  }",
        "  0",
        "}",
        "",
      ].join("\n"),
      "<lifetime-dup-stage0>",
      { backend: "selfhost" },
    ),
  () =>
    selfhost.compile_source(
      [
        "fn main() : I32 => {",
        "  lifetime a, a {",
        "    1;",
        "  }",
        "  0",
        "}",
        "",
      ].join("\n"),
    ),
  "lifetime-duplicate parity",
  "E_RESOLVE_DUPLICATE_LIFETIME",
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
fn add_pair(left: I32, right: I32) : I32 => left + right;
fn main() : I32 => add_pair(1);
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
      modules: { moduleBaseDir: privateDir },
    }),
  () => selfhost.compile_file(privateEntry, privateSelfhostOut),
  "private-import parity",
  "E_MODULE_PRIVATE_IMPORT",
);

// 10) Implicit cross-module reference parity (must require explicit import).
const implicitDir = path.join(outDir, "implicit-import");
const implicitLib = path.join(implicitDir, "Lib.tuff");
const implicitEntry = path.join(implicitDir, "Main.tuff");
const implicitJsOut = path.join(implicitDir, "main-js.js");
const implicitSelfhostOut = path.join(implicitDir, "main-selfhost.js");
fs.mkdirSync(implicitDir, { recursive: true });
fs.writeFileSync(
  implicitLib,
  "out fn shown() : I32 => 1;\nout fn helper() : I32 => 2;\n",
  "utf8",
);
fs.writeFileSync(
  implicitEntry,
  "let { shown } = Lib;\nfn main() : I32 => shown() + helper();\n",
  "utf8",
);

expectBothFail(
  () =>
    compileFileResult(implicitEntry, implicitJsOut, {
      modules: { moduleBaseDir: implicitDir },
    }),
  () => selfhost.compile_file(implicitEntry, implicitSelfhostOut),
  "implicit-import parity",
  "E_MODULE_IMPLICIT_IMPORT",
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
assertDiagCode(
  nullableStage0Diag,
  "E_SAFETY_NULLABLE_POINTER_GUARD",
  "nullable strict-safety parity (stage0)",
);
assertDiagCode(
  nullableSelfhostDiag,
  "E_SAFETY_NULLABLE_POINTER_GUARD",
  "nullable strict-safety parity (selfhost)",
);

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
assertDiagCode(
  moduloStage0Diag,
  "E_SAFETY_MOD_BY_ZERO",
  "modulo strict-safety parity (stage0)",
);
assertDiagCode(
  moduloSelfhostDiag,
  "E_SAFETY_MOD_BY_ZERO",
  "modulo strict-safety parity (selfhost)",
);

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
assertDiagCode(
  overflowStage0Diag,
  "E_SAFETY_INTEGER_OVERFLOW",
  "overflow strict-safety parity (stage0)",
);
assertDiagCode(
  overflowSelfhostDiag,
  "E_SAFETY_INTEGER_OVERFLOW",
  "overflow strict-safety parity (selfhost)",
);

const borrowMoveSource = MOVE_AFTER_MOVE_BOX_SOURCE;
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

const borrowOkSource = makeImmutBorrowedBoxProgram(["  0"]);
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

const copyStructSource = COPY_STRUCT_VEC2_PROGRAM;
const copyStructStage0 = compileSourceResult(
  copyStructSource,
  "<copy-struct-stage0>",
);
const copyStructSelfhost = compileSourceResult(
  copyStructSource,
  "<copy-struct-selfhost>",
  {
    backend: "selfhost",
  },
);
if (!copyStructStage0.ok || !copyStructSelfhost.ok) {
  throw new Error("copy-struct parity: expected both backends to compile");
}

const copyAliasInvalidSource = COPY_ALIAS_INVALID_BOX_SOURCE;
expectBothFail(
  () => compileSourceResult(copyAliasInvalidSource, "<copy-alias-invalid-js>"),
  () => selfhost.compile_source(copyAliasInvalidSource),
  "copy-alias-invalid parity",
  "E_BORROW_INVALID_COPY_ALIAS",
);

const DROPPABLE_I32_TYPE_DECL = `type DroppableI32 = I32 then myDestructor;`;

const destructorSignatureMismatchSource = [
  "type DroppableI32 = I32 then myDestructor;",
  "fn myDestructor(this : *move DroppableI32) : I32 => 1;",
  "fn main() : I32 => 0;",
].join("\n");
expectBothFail(
  () =>
    compileSourceResult(
      destructorSignatureMismatchSource,
      "<destructor-signature-mismatch-js>",
      { backend: "selfhost" },
    ),
  () => selfhost.compile_source(destructorSignatureMismatchSource),
  "destructor-signature-mismatch parity",
  "E_TYPE_DESTRUCTOR_SIGNATURE",
);

const DROPPABLE_I32_PREFIX_DECLS = `${DROPPABLE_I32_TYPE_DECL}
fn myDestructor(this : *move DroppableI32) : Void => {}`;

const droppableI32Prefix = `${DROPPABLE_I32_PREFIX_DECLS}
fn main() : I32 => {
  let x : DroppableI32 = 1;
  drop(x);`;

const dropDoubleDropSource = `
${droppableI32Prefix}
  drop(x);
  0
}
`;
expectBothFail(
  () =>
    compileSourceResult(dropDoubleDropSource, "<drop-double-drop-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(dropDoubleDropSource),
  "drop-double-drop parity",
  "E_BORROW_DOUBLE_DROP",
);

const dropUseAfterDropSource = `
${droppableI32Prefix}
  let y : DroppableI32 = x;
  0
}
`;
expectBothFail(
  () =>
    compileSourceResult(dropUseAfterDropSource, "<drop-use-after-drop-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(dropUseAfterDropSource),
  "drop-use-after-drop parity",
  "E_BORROW_USE_AFTER_DROP",
);

const dropCallResultSource = `
${DROPPABLE_I32_PREFIX_DECLS}
extern fn mk() : DroppableI32;
fn main() : I32 => {
  drop(mk());
  0
}
`;
expectBothFail(
  () =>
    compileSourceResult(dropCallResultSource, "<drop-call-result-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(dropCallResultSource),
  "drop-call-result parity",
  "E_BORROW_INVALID_TARGET",
);

const intoCallFormSource = [
  "contract Vehicle {",
  "  fn drive(*me) : I32;",
  "}",
  "struct Box { v : I32 }",
  "fn makeVehicle() : Box => {",
  "  into Vehicle;",
  "  Box { v: 1 }",
  "}",
  "fn drive(me : *mut Box) : I32 => me.v;",
  "fn main() : I32 => {",
  "  let b : Box = makeVehicle();",
  "  let vehicle = b.into<Vehicle>();",
  "  0",
  "}",
  "",
].join("\n");
const intoCallStage0 = compileSourceResult(
  intoCallFormSource,
  "<into-call-stage0>",
  {
    backend: "selfhost",
  },
);
const intoCallSelfhost = compileSourceResult(
  intoCallFormSource,
  "<into-call-selfhost>",
  { backend: "selfhost" },
);
if (!intoCallStage0.ok || !intoCallSelfhost.ok) {
  throw new Error("into-call-form parity: expected both backends to compile");
}

const intoValueUseAfterMoveSource = [
  "contract Vehicle {",
  "  fn drive(*me) : I32;",
  "}",
  "struct Box { v : I32 }",
  "fn makeVehicle() : Box => {",
  "  into Vehicle;",
  "  Box { v: 1 }",
  "}",
  "fn drive(me : *mut Box) : I32 => me.v;",
  "fn main() : I32 => {",
  "  let b : Box = makeVehicle();",
  "  let converter = b.into<Vehicle>;",
  "  b.v",
  "}",
  "",
].join("\n");
expectBothFail(
  () =>
    compileSourceResult(intoValueUseAfterMoveSource, "<into-value-uam-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(intoValueUseAfterMoveSource),
  "into-value-use-after-move parity",
  "E_BORROW_USE_AFTER_MOVE",
);

const dropZeroArgsSource = `
fn main() : I32 => {
  drop();
  0
}
`;
expectBothFail(
  () =>
    compileSourceResult(dropZeroArgsSource, "<drop-zero-args-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(dropZeroArgsSource),
  "drop-zero-args parity",
  "E_RESOLVE_UNKNOWN_IDENTIFIER",
);

const dropTwoArgsSource = `
fn main() : I32 => {
  drop(1, 2);
  0
}
`;
expectBothFail(
  () =>
    compileSourceResult(dropTwoArgsSource, "<drop-two-args-js>", {
      backend: "selfhost",
    }),
  () => selfhost.compile_source(dropTwoArgsSource),
  "drop-two-args parity",
  "E_RESOLVE_UNKNOWN_IDENTIFIER",
);

console.log("Selfhost differential parity checks passed");
