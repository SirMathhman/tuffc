# Spec 1: Integer Literals

## Objective

A Tuff integer literal (optionally suffixed with a type) compiles to a TypeScript program that:

1. Passes ESLint with the project's config (no lint errors)
2. Exits with the value of that integer when run via `bun --eval`

Invalid literals must be rejected at compile time (i.e. `compileTuffToTS` must throw).

## User Stories

- As a compiler user, I want `100U8` to compile to TypeScript that exits with code 100, so
  that typed integer literals can serve as program exit codes.
- As a compiler user, I want valid boundary values (e.g. `0U8`, `255U8`) to compile correctly
  so that the full range of a type is usable.
- As a compiler user, I want bare integer literals (e.g. `100`, defaulting to I32) to produce
  the correct exit code, so that untyped literals are still first-class programs.
- As a compiler user, I want the compiler to reject out-of-range values, unknown type suffixes,
  negative unsigned literals, and non-integer literals with an explicit error, so that type
  safety is enforced at compile time rather than at runtime.

## Integer Types

| Suffix | Range           | Notes    |
| ------ | --------------- | -------- |
| U8     | 0 .. 255        | Unsigned |
| I8     | -128 .. 127     | Signed   |
| U16    | 0 .. 65535      |          |
| I16    | -32768 .. 32767 |          |
| U32    | 0 .. 2³²-1      |          |
| I32    | -2³¹ .. 2³¹-1   | Default  |
| U64    | 0 .. 2⁶⁴-1      |          |
| I64    | -2⁶³ .. 2⁶³-1   |          |

Bare literals with no suffix default to **I32**.

## Scope

### In scope

- Suffixed integer literals: `100U8`, `255U8`, `0U8`, `100I32`, `100` (bare)
- Compile-time rejection of: out-of-range (`256U8`), invalid suffix (`100U9`), negative
  unsigned (`-1U8`), non-integer (`1.5U8`)

### Out of scope

- Negative I-type exit code verification (OS-specific behaviour)
- Floating-point literals
- Arithmetic expressions
- Multi-statement programs

## Constraints

- The compiled output must be valid TypeScript and pass ESLint
- The compiled output must exit with exactly the literal's numeric value when run via Bun
- `compileTuffToTS` must throw a descriptive `Error` for all invalid inputs listed above
