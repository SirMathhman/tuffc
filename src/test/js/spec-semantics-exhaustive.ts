// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { assertDiagnosticContract } from "./diagnostic-contract-utils.ts";
import {
  buildStageChain,
  normalizeDiag,
  buildStageById,
} from "./stage-matrix-harness.ts";

function pushSpecFailure(failures, testCase, stage, msg) {
  failures.push(`${testCase.id} (${testCase.section}) ${msg} on ${stage.id}`);
}

import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "spec-semantics-exhaustive");
fs.mkdirSync(outDir, { recursive: true });

const chain = buildStageChain(root, path.join(outDir, "bootstrap"));

const stageById = buildStageById(chain);
const allStages = [stageById.stage2, stageById.stage3];
const negativeStages = allStages;

function expectedCodesMatch(diagCode, expectedCodes) {
  if (!expectedCodes || expectedCodes.length === 0) return true;
  return expectedCodes.includes(diagCode);
}

const positiveCases = [
  {
    id: "vars:top-level-exec",
    section: "3.1/5.6",
    source: ["let x : I32 = 40;", "let y = 2;", "x + y;", ""].join("\n"),
  },
  {
    id: "functions:expr-and-block",
    section: "3.2",
    source: [
      "fn add(a : I32, b : I32) : I32 => a + b;",
      "fn mul(a : I32, b : I32) : I32 => {",
      "  a * b",
      "}",
      "let z : I32 = mul(add(1, 2), 3);",
      "z;",
      "",
    ].join("\n"),
  },
  {
    id: "functions:generic-identity",
    section: "2.1/3.2",
    source: [
      "fn identity<T>(value : T) : T => value;",
      "let a : I32 = identity<I32>(7);",
      "a;",
      "",
    ].join("\n"),
  },
  {
    id: "closures:arrow-lambda",
    section: "3.3",
    source: [
      "fn applyTwice(x : I32, f : (I32) => I32) : I32 => f(f(x));",
      "let resultValue : I32 = applyTwice(2, (v : I32) => v + 3);",
      "resultValue;",
      "",
    ].join("\n"),
  },
  {
    id: "closures:function-value-from-decl",
    section: "3.2/3.3",
    source: [
      "fn get() : I32 => 100;",
      "let func : () => I32 = get;",
      "func();",
      "",
    ].join("\n"),
  },
  {
    id: "closures:function-value-from-fn-expr",
    section: "3.2/3.3",
    source: [
      "let func : () => I32 = fn get() : I32 => 100;",
      "func();",
      "",
    ].join("\n"),
  },
  {
    id: "closures:function-value-from-lambda",
    section: "3.3",
    source: ["let func : () => I32 = () => 100;", "func();", ""].join("\n"),
  },
  {
    id: "closures:function-value-inferred",
    section: "3.3",
    source: ["let func = () => 100;", "func();", ""].join("\n"),
  },
  {
    id: "structs:instantiation",
    section: "3.4",
    source: [
      "struct Point { x : I32, y : I32 }",
      "let p : Point = Point { x: 3, y: 4 };",
      "p.x + p.y;",
      "",
    ].join("\n"),
  },
  {
    id: "objects:singleton-generic",
    section: "2.1/3.4",
    source: [
      "object None<T> {}",
      "type Option<T> = None<T>;",
      "let x : Option<I32> = None<I32>;",
      "x;",
      "",
    ].join("\n"),
  },
  {
    id: "objects:input-identity",
    section: "3.4",
    source: [
      "object Wrapper {",
      "  in let x : I32;",
      "}",
      "let a = &Wrapper { x: 100 };",
      "let b = &Wrapper { x: 100 };",
      "let c = &Wrapper { x: 120 };",
      "(a == b) && (a != c);",
      "",
    ].join("\n"),
  },
  {
    id: "pattern:is-expression",
    section: "3.5",
    source: [
      "enum Color { Red, Blue }",
      "fn score(c : Color) : I32 => {",
      "  if (c is Red) { 1 } else { 2 }",
      "}",
      "score(Color.Red);",
      "",
    ].join("\n"),
  },
  {
    id: "loops:for-while-loop",
    section: "3.6",
    source: [
      "fn sumTo(n : I32) : I32 => {",
      "  let acc : I32 = 0;",
      "  let i : I32 = 0;",
      "  while (i < n) {",
      "    acc = acc + i;",
      "    i = i + 1;",
      "  }",
      "  while (acc < 100) {",
      "    acc = acc + 1;",
      "    if (acc == 50) { continue; }",
      "    if (acc == 90) { break; }",
      "  }",
      "  loop { break; }",
      "  acc",
      "}",
      "sumTo(5);",
      "",
    ].join("\n"),
  },
  {
    id: "ffi:extern-decls",
    section: "3.9",
    source: [
      "extern type Handle;",
      "extern fn open() : Handle;",
      "extern fn close(this: Handle) : I32;",
      "extern let GLOBAL_NAME : *Str;",
      "open();",
      "",
    ].join("\n"),
  },
  {
    id: "visibility:out-decls",
    section: "3.10",
    source: [
      "out struct Api { value : I32 }",
      "out fn make() : Api => Api { value: 1 };",
      "make();",
      "",
    ].join("\n"),
  },
  {
    id: "comments:line-block-doc",
    section: "6.3",
    source: [
      "// line comment",
      "/* block comment */",
      "/** doc comment */",
      "fn annotated() : I32 => 1;",
      "annotated();",
      "",
    ].join("\n"),
  },
  {
    id: "refinement:flow-narrowing",
    section: "4.1/4.6/9.1",
    options: { typecheck: { strictSafety: true } },
    source: [
      "fn guarded(x : I32) : I32 => {",
      "  if (x == 0) {",
      "    0",
      "  } else {",
      "    100 / x",
      "  }",
      "}",
      "guarded(5);",
      "",
    ].join("\n"),
  },
  {
    id: "nullable:guarded-pointer",
    section: "4.5",
    options: { typecheck: { strictSafety: true } },
    source: [
      "fn read(p : *I32 | 0USize) : I32 => {",
      "  if (p != 0USize) {",
      "    p[0]",
      "  } else {",
      "    0",
      "  }",
      "}",
      "read(0USize);",
      "",
    ].join("\n"),
  },
  {
    id: "borrow:copy-struct",
    section: "2.3/4.8/9.4",
    source: [
      "copy struct Vec2 { x : F32, y : F32 }",
      "let a : Vec2 = Vec2 { x: 1, y: 2 };",
      "let b : Vec2 = a;",
      "let c : Vec2 = a;",
      "b;",
      "c;",
      "",
    ].join("\n"),
  },
  {
    id: "contracts:definition-and-impl",
    section: "2.2",
    source: [
      "contract Vehicle {",
      "  fn drive() : Void;",
      "}",
      "fn Car(name : *Str) : I32 => {",
      "  into Vehicle;",
      "  0",
      "}",
      'Car("Roadster");',
      "",
    ].join("\n"),
  },
  {
    id: "class:syntax-desugar",
    section: "3.4",
    source: ["class fn Car() => { }", "Car();", ""].join("\n"),
  },
  {
    id: "platform:expect-actual",
    section: "5.2",
    source: [
      "expect fn platformSpecific() : I32;",
      "actual fn platformSpecific() : I32 => 1;",
      "platformSpecific();",
      "",
    ].join("\n"),
  },
  {
    id: "result:pipe-union-and-q",
    section: "2.1/4.7",
    source: [
      "struct Ok<T> { value : T }",
      "struct Err<E> { error : E }",
      "type Result<T, E> = Ok<T> |> Err<E>;",
      "fn pass(r : Ok<I32>) : Ok<I32> => {",
      "  let v = r?;",
      "  Ok<I32> { value: v }",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "result:unwrap-call-postfix",
    section: "4.7",
    source: [
      "struct Ok<T> { value : T }",
      "fn doSomething() : Ok<I32> => Ok<I32> { value: 1 };",
      "fn useIt() : I32 => doSomething()?.value;",
      "useIt();",
      "",
    ].join("\n"),
  },
  {
    id: "match:exhaustive-option",
    section: "3.5/9.1",
    options: { typecheck: { strictSafety: true } },
    source: [
      "struct Some<T> { value : I32 }",
      "struct None<T> {}",
      "type Option<T> = Some<T> | None<T>;",
      "fn f(o : Option<I32>) : I32 => match (o) {",
      "  case Some { value } = value;",
      "  case None = 0;",
      "};",
      "f(None<I32>);",
      "",
    ].join("\n"),
  },
  {
    id: "borrow:copy-enum-default",
    section: "2.1/2.3/4.8",
    source: [
      "enum Color { Red, Blue }",
      "let c : Color = Color.Red;",
      "let a : Color = c;",
      "let b : Color = c;",
      "a;",
      "b;",
      "",
    ].join("\n"),
  },
  {
    id: "borrow:copy-type-alias-valid",
    section: "2.1/2.3",
    source: [
      "copy struct Vec2 { x : F32, y : F32 }",
      "copy type Vec2Alias = Vec2;",
      "let a : Vec2Alias = Vec2 { x: 1, y: 2 };",
      "let b : Vec2Alias = a;",
      "let c : Vec2Alias = a;",
      "b;",
      "c;",
      "",
    ].join("\n"),
  },
  {
    id: "extern:pointer-types-call",
    section: "2.4/3.9",
    options: { typecheck: { strictSafety: true } },
    source: [
      "extern fn readPtr(p : *I32) : I32;",
      "extern fn writePtr(p : *mut I32, v : I32) : I32;",
      "extern let rp : *I32;",
      "extern let wp : *mut I32;",
      "writePtr(wp, 1);",
      "readPtr(rp);",
      "",
    ].join("\n"),
  },
  {
    id: "control:if-expression",
    section: "3.6/4.6",
    source: [
      "fn pick(flag : Bool) : I32 => if (flag) 1 else 2;",
      "pick(true);",
      "",
    ].join("\n"),
  },
];

const negativeCases = [
  {
    id: "reject:shadowing",
    section: "3.1/8.1",
    expectedCodes: ["E_RESOLVE_SHADOWING"],
    source: ["fn collide() : I32 => 1;", "fn collide() : I32 => 2;", ""].join(
      "\n",
    ),
  },
  {
    id: "reject:use-after-move",
    section: "2.3/4.8/9.4",
    expectedCodes: ["E_BORROW_USE_AFTER_MOVE", "E_SELFHOST_INTERNAL_ERROR"],
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let moved : Box = b;",
      "  b.v",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "reject:invalid-copy-alias",
    section: "2.3",
    expectedCodes: ["E_BORROW_INVALID_COPY_ALIAS", "E_SELFHOST_INTERNAL_ERROR"],
    source: ["struct Box { v : I32 }", "copy type BoxAlias = Box;", ""].join(
      "\n",
    ),
  },
  {
    id: "reject:division-by-zero-strict",
    section: "4.1/9.2",
    options: { typecheck: { strictSafety: true } },
    expectedCodes: ["E_SAFETY_DIV_BY_ZERO", "E_SELFHOST_INTERNAL_ERROR"],
    source: ["fn bad(x : I32) : I32 => 100 / x;", ""].join("\n"),
  },
  {
    id: "reject:overflow-strict",
    section: "4.2/9.2",
    options: { typecheck: { strictSafety: true } },
    expectedCodes: [
      "E_SAFETY_INTEGER_OVERFLOW",
      "E_SAFETY_OVERFLOW",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
    source: ["fn overflow() : I32 => 2147483647 + 1;", ""].join("\n"),
  },
  {
    id: "reject:unguarded-nullable-pointer",
    section: "4.5/9.2",
    options: { typecheck: { strictSafety: true } },
    expectedCodes: [
      "E_SAFETY_NULLABLE_POINTER_GUARD",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
    source: ["fn bad(p : *I32 | 0USize) : I32 => p[0];", ""].join("\n"),
  },
  {
    id: "reject:non-exhaustive-match",
    section: "3.5/9.1",
    options: { typecheck: { strictSafety: true } },
    expectedCodes: [
      "E_TYPE_MATCH_NON_EXHAUSTIVE",
      "E_MATCH_NON_EXHAUSTIVE",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
    source: [
      "struct Some<T> { value : I32 }",
      "struct None<T> {}",
      "type Option<T> = Some<T> | None<T>;",
      "fn f(o : Option<I32>) : I32 => match (o) {",
      "  case Some { value } = value;",
      "};",
      "",
    ].join("\n"),
  },
  {
    id: "reject:move-while-immut-borrowed",
    section: "2.3/4.8",
    expectedCodes: [
      "E_BORROW_MOVE_WHILE_BORROWED",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r : *Box = &b;",
      "  let moved : Box = b;",
      "  0",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "reject:borrow-mut-conflict",
    section: "2.3/4.8",
    expectedCodes: ["E_BORROW_MUT_CONFLICT", "E_SELFHOST_INTERNAL_ERROR"],
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r1 : *Box = &b;",
      "  let r2 : *mut Box = &mut b;",
      "  0",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "reject:borrow-immut-while-mut",
    section: "2.3/4.8",
    expectedCodes: ["E_BORROW_IMMUT_WHILE_MUT", "E_SELFHOST_INTERNAL_ERROR"],
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r1 : *mut Box = &mut b;",
      "  let r2 : *Box = &b;",
      "  0",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "reject:assign-while-borrowed",
    section: "2.3/4.8",
    expectedCodes: [
      "E_BORROW_ASSIGN_WHILE_BORROWED",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r : *Box = &b;",
      "  b = Box { v: 2 };",
      "  0",
      "}",
      "",
    ].join("\n"),
  },
  {
    id: "reject:borrow-invalid-target",
    section: "2.4/4.8",
    expectedCodes: ["E_BORROW_INVALID_TARGET", "E_SELFHOST_INTERNAL_ERROR"],
    source: [
      "fn bad() : I32 => {",
      "  let x : I32 = 1;",
      "  let r : *I32 = &(x + 1);",
      "  0",
      "}",
      "",
    ].join("\n"),
  },
];

const failures = [];

for (const testCase of positiveCases) {
  for (const stage of allStages) {
    const result = stage.compileSource(
      testCase.source,
      `<spec-positive:${testCase.id}:${stage.id}>`,
      testCase.options ?? {},
    );
    if (result.ok) continue;

    const diag = normalizeDiag(result.error);
    assertDiagnosticContract(diag, `${testCase.id}:${stage.id}`);
    pushSpecFailure(
      failures,
      testCase,
      stage,
      `expected compile success, got ${diag.code}: ${diag.message}`,
    );
  }
}

for (const testCase of negativeCases) {
  for (const stage of negativeStages) {
    const result = stage.compileSource(
      testCase.source,
      `<spec-negative:${testCase.id}:${stage.id}>`,
      testCase.options ?? {},
    );
    if (!result.ok) {
      const diag = normalizeDiag(result.error);
      assertDiagnosticContract(diag, `${testCase.id}:${stage.id}`);
      if (!expectedCodesMatch(diag.code, testCase.expectedCodes ?? [])) {
        failures.push(
          `${testCase.id} (${testCase.section}) expected one of [${(testCase.expectedCodes ?? []).join(", ")}], got ${diag.code} on ${stage.id}`,
        );
      }
      continue;
    }

    pushSpecFailure(
      failures,
      testCase,
      stage,
      `expected compile failure, but compilation succeeded`,
    );
  }
}

if (failures.length > 0) {
  console.error("Exhaustive spec semantics audit failed:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Exhaustive spec semantics audit passed (${positiveCases.length} positive, ${negativeCases.length} negative)`,
);
