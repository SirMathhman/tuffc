# Spec 7: Boolean operators ||, &&, !

## Overview

Three boolean operators are added: `||` (OR), `&&` (AND), and `!` (NOT).
All require Bool operands and produce a Bool result.

## Grammar additions

```
expression := or_expr
or_expr    := and_expr ('||' and_expr)*
and_expr   := not_expr ('&&' not_expr)*
not_expr   := '!' not_expr | add_expr
```

## Precedence (highest to lowest, within bool tier)

| Operator | Associativity |
| -------- | ------------- |
| `!`      | Right (unary) |
| `&&`     | Left          |
| `\|\|`   | Left          |

Arithmetic operators (`+`, `-`, `*`, `/`) sit inside `not_expr → add_expr`,
so they bind tighter than any boolean operator.

## Type rules

- Both operands of `||` and `&&` must be `Bool` — compile error if either is an integer.
- The operand of `!` must be `Bool` — compile error if integer.
- Result type of all three operators is `Bool`.

## Code generation

| Tuff       | Generated JS |
| ---------- | ------------ |
| `a \|\| b` | `a \|\| b`   |
| `a && b`   | `a && b`     |
| `!a`       | `!a`         |

Short-circuit evaluation is inherited from JS.

## Error cases

- `true || 1U8` → `Type error: || requires Bool operands`
- `1U8 && false` → `Type error: && requires Bool operands`
- `!5U8` → `Type error: ! requires Bool operand`
