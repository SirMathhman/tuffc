# Numeric Literals — Full Type Suite

Extends `1-u8-literal.spec.md`. That document remains valid; this document
adds the full set of numeric types and compile-time range enforcement.

## User stories

- As a caller, I want all unsigned integer types (`U8`, `U16`, `U32`, `U64`)
  to be usable as compile-time literals so I can express exact unsigned values.
- As a caller, I want all signed integer types (`I8`, `I16`, `I32`, `I64`) to
  be usable as compile-time literals so I can express negative and positive
  integer values.
- As a caller, I want both float types (`F32`, `F64`) to be usable as
  compile-time literals so I can express fractional values.
- As a caller, I want out-of-range literals to produce a compile-time error so
  I cannot accidentally rely on undefined overflow behaviour.
- As a caller, I want negative literals to be rejected for unsigned types so
  that unsigned intent is enforced.

## Scope

- The public `compileTuffAndExecute` function must compile and execute numeric
  literals for all 10 types: `U8`, `U16`, `U32`, `U64`, `I8`, `I16`, `I32`,
  `I64`, `F32`, `F64`.
- **Integer literal syntax**: `<decimal-digits><TYPE>` for unsigned types;
  `[-]<decimal-digits><TYPE>` for signed integer types.
- **Float literal syntax**: `[-]<decimal-digits>[.<decimal-digits>]<TYPE>`.
  Scientific notation is **not** in scope for this iteration.
- Type suffixes are case-sensitive; only uppercase suffixes (e.g. `U8`, `F32`)
  are valid.
- Only decimal literals are in scope; hex/binary/octal are not.
- Out-of-range values (including negative values on unsigned types) throw a
  compile-time `Error`.
- For `U64`/`I64`, values beyond JavaScript's 2^53 safe-integer boundary are
  range-checked via `BigInt` but returned with acknowledged precision loss as a
  JS `number`.
- The return value is always the mathematical value of the literal (no
  truncation or wrapping).

## Range table

| Type | Min                        | Max                        |
| ---- | -------------------------- | -------------------------- |
| U8   | 0                          | 255                        |
| U16  | 0                          | 65 535                     |
| U32  | 0                          | 4 294 967 295              |
| U64  | 0                          | 18 446 744 073 709 551 615 |
| I8   | -128                       | 127                        |
| I16  | -32 768                    | 32 767                     |
| I32  | -2 147 483 648             | 2 147 483 647              |
| I64  | -9 223 372 036 854 775 808 | 9 223 372 036 854 775 807  |
| F32  | ≈ -3.4028235 × 10^38       | ≈ 3.4028235 × 10^38        |
| F64  | any finite IEEE-754 double | any finite IEEE-754 double |
