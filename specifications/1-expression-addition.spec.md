# Specification: interpretTuff additive U8 expressions

## Objective

Extend `interpretTuff` to evaluate additive expressions composed of one or more U8 literals and `+`, while keeping structured `Result` error reporting.

## User stories

- As a caller, I want `interpretTuff("100U8 + 50U8")` to return success with value `150` so arithmetic expressions can be interpreted.
- As a caller, I want chained expressions like `1U8 + 2U8 + 3U8` to work so multiple terms are supported.
- As a caller, I want flexible whitespace around terms and `+` so input formatting is ergonomic.
- As a caller, I want invalid expressions to return `ok=0` with descriptive static errors so failures are actionable without allocation.
- As a caller, I want sum overflow beyond U8 range (`>255`) to fail with a descriptive error so semantics remain U8-safe.
- As a caller, I want single-literal behavior preserved so existing valid inputs remain compatible.

## Non-goals

- Supporting operators other than `+`.
- Supporting lowercase literal suffixes (`u8`).
- Supporting signed numbers, hexadecimal, or parenthesized expressions.
