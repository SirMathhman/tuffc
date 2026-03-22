# Boolean Operations

Extends the earlier boolean specification with logical and comparison
operators.

## User stories

- As a caller, I want `!` so I can invert boolean values.
- As a caller, I want `&&` and `||` so I can combine boolean conditions.
- As a caller, I want `==` and `!=` for booleans so I can compare boolean
  values directly.
- As a caller, I want boolean operators to short-circuit where appropriate so
  unnecessary evaluation does not happen.
- As a caller, I want invalid boolean/numeric combinations to fail clearly so
  boolean operations remain type-safe.

## Scope

- Boolean negation with `!` is supported.
- Logical conjunction `&&` and disjunction `||` are supported.
- Boolean equality `==` and inequality `!=` are supported.
- `&&` and `||` short-circuit evaluation.
- Boolean operators require `Bool` operands and do not implicitly coerce
  numeric values.
- Boolean operator precedence follows the usual order: `!` highest, then
  equality, then `&&`, then `||`.
