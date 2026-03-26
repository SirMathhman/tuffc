# Spec 5: Mutable variables (`let mut`) and reassignment

## Overview

`let mut` declares a mutable variable. Mutable variables can be reassigned
with `x = expr;`. Immutable `let` variables cannot be reassigned.

## Grammar additions

```
statement := let_stmt | let_mut_stmt | assign_stmt
let_mut_stmt := 'let' 'mut' NAME (':' suffix)? '=' expression ';'
assign_stmt  := NAME '=' expression ';'
```

## Type rules

### `let mut x = expr;` (no annotation)

- Inferred type = inferred type of `expr`.

### `let mut x: T = expr;` (with annotation)

- Same widening rule as `let`: `T` must cover the range of the inferred type.

### `x = expr;` (reassignment)

- `x` must have been declared with `let mut`.
- Inferred type of `expr` must be compatible with `x`'s declared type (same
  widening rule: `x.type` must cover inferred type's range).

## Code generation

`let mut x = expr;` → `let x = <expr>;`
`x = expr;` → `x = <expr>;`

(JS `let` is used so reassignment is legal in the generated code.)

## Error cases

- `x = expr;` where `x` is immutable → `Type error: cannot assign to immutable variable "x"`
- `x = expr;` where `x` is undeclared → `Type error: unknown variable "x"`
- Inferred type not compatible with declared → `Type error: cannot assign <inferred> to <declared>`

## Shadowing interaction

A second `let` or `let mut` shadows the previous binding. Reassignment always
targets the most recent binding for that name.
