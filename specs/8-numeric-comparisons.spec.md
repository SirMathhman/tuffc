# Numeric Comparisons

Adds numeric comparison expressions to the language.

## User stories

- As a caller, I want to compare numeric expressions with `<`, `<=`, `>`, and `>=` so I can express ordering conditions.
- As a caller, I want numeric comparisons to return `Bool` so they compose naturally with boolean expressions.
- As a caller, I want arithmetic to bind tighter than comparisons so expressions like `1U8 + 2U8 < 4U8` behave as expected.
- As a caller, I want chained comparisons such as `1U8 < 2U8 < 3U8` rejected so comparison semantics remain explicit and type-safe.
- As a caller, I want comparisons involving non-numeric operands to fail clearly so implicit coercions do not hide bugs.

## Scope

- Supports `<`, `<=`, `>`, and `>=` between numeric operands.
- Numeric comparisons evaluate to `Bool`.
- Comparison precedence is lower than arithmetic and higher than boolean `&&` / `||` composition.
- Chained comparisons are rejected with an error.
- Comparing `Bool` with numeric values is rejected.

## Non-goals

- This iteration does not add custom coercion rules between booleans and numerics.
- This iteration does not change existing boolean equality semantics beyond enabling composition with numeric comparison results.
