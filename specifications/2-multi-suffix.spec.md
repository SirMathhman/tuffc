# Specification: multi-suffix integer literals and addition

## Objective

Extend `interpretTuff` to support integer literal suffixes `U8`, `U16`, `U32`, `U64`, `I8`, `I16`, `I32`, `I64`, including chained `+` expressions with optional whitespace.

## User stories

- As a caller, I want `interpretTuff` to parse literals with all supported suffixes so the language can represent multiple integer widths.
- As a caller, I want signed literals to accept an optional leading `-` for `I*` suffixes.
- As a caller, I want chained additions (e.g., `a + b + c`) to evaluate correctly with optional whitespace.
- As a caller, I want mixed signed/unsigned terms to follow C-like usual arithmetic conversions so promotion behavior is predictable.
- As a caller, I want overflow or out-of-range values for the effective type to return `ok=0` with descriptive static errors.
- As a caller, I want successful results to include 64-bit payload fields for both signed and unsigned interpretations plus an `is_unsigned` flag.

## Result shape

`Result` will be:

- `int ok`
- `unsigned long long uvalue`
- `long long svalue`
- `int is_unsigned`
- `const char *error`

## Non-goals

- Operators other than `+`.
- Lowercase suffix variants.
- Floating-point parsing.
- Parentheses or precedence rules beyond left-to-right addition.
