// @ts-nocheck
import {
  expectCompileFailCode as expectFailCode,
  expectCompileOk as expectOk,
} from "./compile-test-utils.ts";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";

expectOk(
  "destructor-signature-ok",
  [
    "type DroppableI32 = I32 then myDestructor;",
    "fn myDestructor(this : *move DroppableI32) : Void => {}",
    "fn main() : I32 => 0;",
    "",
  ].join("\n"),
  { backend: "stage0" },
);

expectFailCode(
  "destructor-signature-return-mismatch",
  [
    "type DroppableI32 = I32 then myDestructor;",
    "fn myDestructor(this : *move DroppableI32) : I32 => 1;",
    "fn main() : I32 => 0;",
    "",
  ].join("\n"),
  "E_TYPE_DESTRUCTOR_SIGNATURE",
  { backend: "stage0" },
);

const implicitScopeDropSource = [
  "let mut counter : I32 = 0;",
  "type DroppableI32 = I32 then myDestructor;",
  "fn myDestructor(this : *move DroppableI32) : Void => {",
  "  counter = counter + 1;",
  "}",
  "fn main() : I32 => {",
  "  {",
  "    let x : DroppableI32 = 42;",
  "  }",
  "  counter",
  "}",
  "",
].join("\n");

const implicitScopeDropResult = compileSourceResult(
  implicitScopeDropSource,
  "<destructor-implicit-scope-drop>",
  { backend: "stage0" },
);
if (!implicitScopeDropResult.ok) {
  console.error(
    `Expected implicit scope drop sample to compile, got: ${implicitScopeDropResult.error.message}`,
  );
  process.exit(1);
}
const implicitScopeDropValue = runMainFromJs(
  implicitScopeDropResult.value.js,
  "destructor-implicit-scope-drop",
);
if (implicitScopeDropValue !== 1) {
  console.error(
    `Expected implicit scope drop counter=1, got ${JSON.stringify(implicitScopeDropValue)}`,
  );
  process.exit(1);
}

const overwriteDropSource = [
  "let mut counter : I32 = 0;",
  "type DroppableI32 = I32 then myDestructor;",
  "fn myDestructor(this : *move DroppableI32) : Void => {",
  "  counter = counter + 1;",
  "}",
  "fn main() : I32 => {",
  "  let mut x : DroppableI32 = 1;",
  "  x = 2;",
  "  counter",
  "}",
  "",
].join("\n");

const overwriteDropResult = compileSourceResult(
  overwriteDropSource,
  "<destructor-overwrite-drop>",
  { backend: "stage0" },
);
if (!overwriteDropResult.ok) {
  console.error(
    `Expected overwrite drop sample to compile, got: ${overwriteDropResult.error.message}`,
  );
  process.exit(1);
}
const overwriteDropValue = runMainFromJs(
  overwriteDropResult.value.js,
  "destructor-overwrite-drop",
);
if (overwriteDropValue !== 1) {
  console.error(
    `Expected overwrite-triggered drop counter=1, got ${JSON.stringify(overwriteDropValue)}`,
  );
  process.exit(1);
}

const explicitDropNoImplicitDoubleSource = [
  "let mut counter : I32 = 0;",
  "type DroppableI32 = I32 then myDestructor;",
  "fn myDestructor(this : *move DroppableI32) : Void => {",
  "  counter = counter + 1;",
  "}",
  "fn main() : I32 => {",
  "  let x : DroppableI32 = 1;",
  "  drop(x);",
  "  counter",
  "}",
  "",
].join("\n");

const explicitDropNoImplicitDoubleResult = compileSourceResult(
  explicitDropNoImplicitDoubleSource,
  "<destructor-explicit-drop-no-implicit-double>",
  { backend: "stage0" },
);
if (!explicitDropNoImplicitDoubleResult.ok) {
  console.error(
    `Expected explicit drop sample to compile, got: ${explicitDropNoImplicitDoubleResult.error.message}`,
  );
  process.exit(1);
}
const explicitDropNoImplicitDoubleValue = runMainFromJs(
  explicitDropNoImplicitDoubleResult.value.js,
  "destructor-explicit-drop-no-implicit-double",
);
if (explicitDropNoImplicitDoubleValue !== 1) {
  console.error(
    `Expected explicit drop to run exactly once, got ${JSON.stringify(explicitDropNoImplicitDoubleValue)}`,
  );
  process.exit(1);
}

const returnPathDropSource = [
  "let mut counter : I32 = 0;",
  "type DroppableI32 = I32 then myDestructor;",
  "fn myDestructor(this : *move DroppableI32) : Void => {",
  "  counter = counter + 1;",
  "}",
  "fn early() : I32 => {",
  "  let x : DroppableI32 = 99;",
  "  return 10;",
  "}",
  "fn main() : I32 => {",
  "  early();",
  "  counter",
  "}",
  "",
].join("\n");

const returnPathDropResult = compileSourceResult(
  returnPathDropSource,
  "<destructor-return-path-drop>",
  { backend: "stage0" },
);
if (!returnPathDropResult.ok) {
  console.error(
    `Expected return-path drop sample to compile, got: ${returnPathDropResult.error.message}`,
  );
  process.exit(1);
}
const returnPathDropValue = runMainFromJs(
  returnPathDropResult.value.js,
  "destructor-return-path-drop",
);
if (returnPathDropValue !== 1) {
  console.error(
    `Expected destructor to run on early return, got ${JSON.stringify(returnPathDropValue)}`,
  );
  process.exit(1);
}

expectFailCode(
  "destructor-use-after-drop",
  [
    "type DroppableI32 = I32 then myDestructor;",
    "fn myDestructor(this : *move DroppableI32) : Void => {}",
    "fn main() : I32 => {",
    "  let x : DroppableI32 = 1;",
    "  drop(x);",
    "  let y : DroppableI32 = x;",
    "  0",
    "}",
    "",
  ].join("\n"),
  "E_BORROW_USE_AFTER_DROP",
  { backend: "stage0" },
);

expectFailCode(
  "destructor-double-drop",
  [
    "type DroppableI32 = I32 then myDestructor;",
    "fn myDestructor(this : *move DroppableI32) : Void => {}",
    "fn main() : I32 => {",
    "  let x : DroppableI32 = 1;",
    "  x.drop();",
    "  drop(x);",
    "  0",
    "}",
    "",
  ].join("\n"),
  "E_BORROW_DOUBLE_DROP",
  { backend: "stage0" },
);

console.log("Destructor semantics checks passed");
