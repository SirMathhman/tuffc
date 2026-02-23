// @ts-nocheck
import {
  expectCompileFailCode as expectFailCode,
  expectCompileOk as expectOk,
} from "./compile-test-utils.ts";
import {
  BORROW_COPY_PRIMITIVE_SOURCE,
  BORROW_INVALID_TARGET_SOURCE,
  COPY_ALIAS_INVALID_BOX_SOURCE,
  COPY_STRUCT_VEC2_PROGRAM,
  COPY_VEC2_ALIAS_PROGRAM,
  makeBoxProgram,
  makeImmutBorrowedBoxProgram,
  MOVE_AFTER_MOVE_BOX_SOURCE,
} from "./test-fixtures.ts";

expectOk("borrow-copy-primitive", BORROW_COPY_PRIMITIVE_SOURCE);

expectOk("borrow-copy-struct", COPY_STRUCT_VEC2_PROGRAM);

expectOk(
  "borrow-copy-enum-default",
  `
enum Color { Red, Blue }
fn main() : I32 => {
  let c : Color = Color.Red;
  let a : Color = c;
  let b : Color = c;
  0
}
`,
);

expectOk("borrow-copy-type-alias", COPY_VEC2_ALIAS_PROGRAM);

expectFailCode(
  "borrow-copy-type-alias-invalid",
  COPY_ALIAS_INVALID_BOX_SOURCE,
  "E_BORROW_INVALID_COPY_ALIAS",
);

expectFailCode(
  "borrow-use-after-move-struct",
  MOVE_AFTER_MOVE_BOX_SOURCE,
  "E_BORROW_USE_AFTER_MOVE",
);

expectFailCode(
  "borrow-move-while-immut-borrowed",
  makeImmutBorrowedBoxProgram(["  let moved : Box = b;", "  0"]),
  "E_BORROW_MOVE_WHILE_BORROWED",
);

expectFailCode(
  "borrow-mut-conflict",
  makeBoxProgram([
    "  let r1 : *Box = &b;",
    "  let r2 : *mut Box = &mut b;",
    "  0",
  ]),
  "E_BORROW_MUT_CONFLICT",
);

expectFailCode(
  "borrow-immut-while-mut",
  makeBoxProgram([
    "  let r1 : *mut Box = &mut b;",
    "  let r2 : *Box = &b;",
    "  0",
  ]),
  "E_BORROW_IMMUT_WHILE_MUT",
);

expectFailCode(
  "borrow-assign-while-borrowed",
  makeImmutBorrowedBoxProgram(["  b = Box { v: 2 };", "  0"]),
  "E_BORROW_ASSIGN_WHILE_BORROWED",
);

expectOk(
  "borrow-lexical-scope-release",
  makeBoxProgram([
    "  if (true) {",
    "    let r : *Box = &b;",
    "    0;",
    "  }",
    "  let moved : Box = b;",
    "  0",
  ]),
);

expectFailCode(
  "borrow-invalid-target",
  BORROW_INVALID_TARGET_SOURCE,
  "E_BORROW_INVALID_TARGET",
);

expectFailCode(
  "borrow-extern-noncopy",
  `
extern type Handle;
extern fn make_handle() : Handle;
fn main() : I32 => {
  let h : Handle = make_handle();
  let a : Handle = h;
  let b : Handle = h;
  0
}
`,
  "E_BORROW_USE_AFTER_MOVE",
);

expectFailCode(
  "borrow-selfhost-backend-enforced",
  MOVE_AFTER_MOVE_BOX_SOURCE,
  "E_BORROW_USE_AFTER_MOVE",
  { backend: "selfhost" },
);

console.log("Borrow checker checks passed");
