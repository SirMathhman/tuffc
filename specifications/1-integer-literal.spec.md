# 1 — Integer Literal Expression

## Objective

`executeTuff("100U8")` must return `100`.

## Context

Builds on spec 0 (empty program). A Tuff program may be a single integer literal expression. When compiled, the value becomes the program's exit code via `process.exit`.

## User Stories

- As a Tuff compiler, I want `compileTuffToTS("100U8")` to produce `process.exit(100);` so that `executeTuff("100U8")` returns `100`.
- As a Tuff compiler, I want out-of-range literals to throw a compile-time error so type safety is enforced early.

## Syntax

An integer literal is: `<digits><Type>`

No spaces. Digits are base-10. The type suffix determines the valid range:

| Type | Signedness | Range                                                  |
| ---- | ---------- | ------------------------------------------------------ |
| U8   | unsigned   | 0 – 255                                                |
| U16  | unsigned   | 0 – 65 535                                             |
| U32  | unsigned   | 0 – 4 294 967 295                                      |
| U64  | unsigned   | 0 – 18 446 744 073 709 551 615                         |
| I8   | signed     | -128 – 127                                             |
| I16  | signed     | -32 768 – 32 767                                       |
| I32  | signed     | -2 147 483 648 – 2 147 483 647                         |
| I64  | signed     | -9 223 372 036 854 775 808 – 9 223 372 036 854 775 807 |

Negative literals: `-<digits><Type>` (I-types only; U-types cannot be negative).

## Compile Output

`compileTuffToTS("<n><T>")` → `process.exit(<n>);`

## Error Cases

- Value out of range for type → `compileTuffToTS` throws `Error`
- Negative value with unsigned type → `compileTuffToTS` throws `Error`

## Exit Code Overflow

For types wider than 8-bit, the OS/Bun naturally truncates exit codes to 0–255. This is acceptable.

## What This Spec Does NOT Cover

- Multiple expressions / statements (future).
- Floating-point types (future).
- Identifiers / variables (future).
