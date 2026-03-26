# Spec 6: Bool type with true/false literals

## Overview

`Bool` is a new first-class type in Tuff, distinct from all integer types.
It has two literals: `true` and `false`.

## Grammar additions

```
atom := ... | 'true' | 'false'
type := IntSuffix | 'Bool'
```

## Type rules

- `true` and `false` have type `Bool`.
- `Bool` is a valid type annotation in `let` and `let mut`.
- `Bool` is compatible only with `Bool` (no cross-type assignment to/from integers).
- `Bool` cannot appear as an operand to `+`, `-`, `*`, `/` — compile error.
- `read<Bool>()` is valid; produces a `Bool` value at runtime.

## Code generation

| Tuff                      | Generated JS                     |
|---------------------------|----------------------------------|
| `true`                    | `true`                           |
| `false`                   | `false`                          |
| `read<Bool>()`            | `readBool()`                     |
| Final Bool expression     | `return <expr> ? 1 : 0;`         |
| Final Int expression      | `return <expr>;` (unchanged)     |

## Runtime / stdin

- `read<Bool>()` compiles to `readBool()`.
- The test harness provides `mockReadBool` that returns `token === "true"` from the stdin token stream (same shared index as `mockRead`).
- Any value other than `"true"` is treated as `false` at runtime.

## Error cases

- `true + 1U8` → `Type error: Bool cannot be used in arithmetic`
- `let x: U8 = true;` → `Type error: cannot assign Bool to U8`
- `let x: Bool = 5U8;` → `Type error: cannot assign U8 to Bool`
