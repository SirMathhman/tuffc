# Boolean Type and Literals

Extends the earlier literal, arithmetic, read, and let specifications with a
first-class boolean type.

## User stories

- As a caller, I want to use `Bool` in type annotations so I can model true/false
  values explicitly.
- As a caller, I want `true` and `false` literals so I can write boolean
  expressions directly.
- As a caller, I want boolean values to flow through `let` bindings and
  reassignment so I can store and reuse them.
- As a caller, I want boolean input and output to behave consistently so the
  public execution API can return `1` for `true` and `0` for `false`.
- As a caller, I want invalid boolean/numeric combinations to fail clearly so
  values are not silently coerced across incompatible types.

## Scope

- `Bool` is a valid type annotation alongside the existing numeric types.
- The literals `true` and `false` are supported and evaluate to boolean values.
- Boolean values may be bound with `let`, inferred from initializers, and
  reassigned through mutable bindings.
- `read<Bool>()` is supported and consumes `true` or `false` from stdin tokens.
- Boolean values are not interchangeable with numeric values.
- The public execution API returns `1` for `true` and `0` for `false`.
- Boolean literals are case-sensitive; only lowercase `true` and `false` are
  valid.
