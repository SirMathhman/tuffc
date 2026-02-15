// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

function expectOk(label, source, options = {}) {
  const result = compileSourceResult(source, `<${label}>`, options);
  if (!result.ok) {
    console.error(
      `Expected compile success for ${label}, but failed: ${result.error.message}`,
    );
    process.exit(1);
  }
}

function expectFailCode(label, source, expectedCode, options = {}) {
  const result = compileSourceResult(source, `<${label}>`, options);
  if (result.ok) {
    console.error(`Expected compile failure for ${label}, but it compiled`);
    process.exit(1);
  }
  const diag = toDiagnostic(result.error);
  if (diag.code !== expectedCode) {
    console.error(
      `Expected ${expectedCode} for ${label}, got ${diag.code} (${diag.message})`,
    );
    process.exit(1);
  }
}

expectOk(
  "borrow-copy-primitive",
  `fn main() : I32 => { let x : I32 = 1; let y : I32 = x; x + y }`,
);

expectFailCode(
  "borrow-use-after-move-struct",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let moved : Box = b;
  b.v
}
`,
  "E_BORROW_USE_AFTER_MOVE",
);

expectFailCode(
  "borrow-move-while-immut-borrowed",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let r : *Box = &b;
  let moved : Box = b;
  0
}
`,
  "E_BORROW_MOVE_WHILE_BORROWED",
);

expectFailCode(
  "borrow-mut-conflict",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let r1 : *Box = &b;
  let r2 : *mut Box = &mut b;
  0
}
`,
  "E_BORROW_MUT_CONFLICT",
);

expectFailCode(
  "borrow-immut-while-mut",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let r1 : *mut Box = &mut b;
  let r2 : *Box = &b;
  0
}
`,
  "E_BORROW_IMMUT_WHILE_MUT",
);

expectFailCode(
  "borrow-assign-while-borrowed",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let r : *Box = &b;
  b = Box { v: 2 };
  0
}
`,
  "E_BORROW_ASSIGN_WHILE_BORROWED",
);

expectOk(
  "borrow-lexical-scope-release",
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  if (true) {
    let r : *Box = &b;
    0;
  }
  let moved : Box = b;
  0
}
`,
);

expectFailCode(
  "borrow-invalid-target",
  `fn main() : I32 => { let x : I32 = 1; let r : *I32 = &(x + 1); 0 }`,
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
  `
struct Box { v : I32 }
fn main() : I32 => {
  let b : Box = Box { v: 1 };
  let moved : Box = b;
  b.v
}
`,
  "E_BORROW_USE_AFTER_MOVE",
  { backend: "selfhost" },
);

console.log("Borrow checker checks passed");
