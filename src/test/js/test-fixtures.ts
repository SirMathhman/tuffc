// @ts-nocheck

export const COPY_STRUCT_VEC2_PROGRAM = `
copy struct Vec2 { x : F32, y : F32 }
fn main() : I32 => {
  let a : Vec2 = Vec2 { x: 1, y: 2 };
  let b : Vec2 = a;
  let c : Vec2 = a;
  0
}
`;

export function makeBoxProgram(lines: string[]): string {
  return [
    "",
    "struct Box { v : I32 }",
    "fn main() : I32 => {",
    "  let b : Box = Box { v: 1 };",
    ...lines,
    "}",
    "",
  ].join("\n");
}

export const MOVE_AFTER_MOVE_BOX_SOURCE = makeBoxProgram([
  "  let moved : Box = b;",
  "  b.v",
]);

export function makeImmutBorrowedBoxProgram(lines: string[]): string {
  return makeBoxProgram(["  let r : *Box = &b;", ...lines]);
}

export const COPY_ALIAS_INVALID_BOX_SOURCE = `
struct Box { v : I32 }
copy type BoxAlias = Box;
fn main() : I32 => 0;
`;

export const STRICT_DIV_BY_ZERO_SOURCE = `fn bad(x : I32) : I32 => 100 / x;`;
export const STRICT_OVERFLOW_SOURCE = `fn bad() : I32 => 2147483647 + 1;`;
export const COPY_VEC2_ALIAS_PROGRAM = `
copy struct Vec3 { x : F32, y : F32, z : F32 }
copy type Vec3Alias = Vec3;
fn main() : I32 => {
  let a : Vec3Alias = Vec3 { x: 1, y: 2, z: 3 };
  let b : Vec3Alias = a;
  let c : Vec3Alias = a;
  0
}
`;
export const NULLABLE_POINTER_UNGUARDED_SOURCE = `fn bad(p : *I32 | 0USize) : I32 => p[0];`;
export const FACTORIAL_PROGRAM = `
fn factorial(n: I32) : I32 => {
  if (n <= 1) { 1 } else { n * factorial(n - 1) }
}
fn main() : I32 => factorial(5);
`;
export const NULLABLE_POINTER_GUARDED_SOURCE = `fn good(p : *I32 | 0USize) : I32 => { if (p != 0USize) { p[0] } else { 0 } }`;
export const NULLABLE_POINTER_GUARDED_REVERSED_SOURCE =
  NULLABLE_POINTER_GUARDED_SOURCE.replace("p != 0USize", "0USize != p");
export const BORROW_COPY_PRIMITIVE_SOURCE = `fn main() : I32 => { let x : I32 = 1; let y : I32 = x; x + y }`;
export const BORROW_INVALID_TARGET_SOURCE = [
  "fn main() : I32 => {",
  "  let x : I32 = 1;",
  "  let r : *I32 = &(x + 1);",
  "  0",
  "}",
].join(" ");
