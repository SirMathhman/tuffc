# Spec 8: Comparison operators <, <=, ==, >=, >, !=

## Overview

Six comparison operators are added. All produce a `Bool` result.

## Grammar additions

```
expression := or_expr
...
not_expr   := '!' not_expr | cmp_expr
cmp_expr   := add_expr (CMP_OP add_expr)?   -- single comparison only, no chaining
CMP_OP     := '<' | '<=' | '==' | '>=' | '>' | '!='
```

No chaining: `a < b < c` is a compile error because `a < b` produces Bool and
`<` requires integer operands on the left.

## Type rules

| Operator             | Left operand | Right operand | Result |
| -------------------- | ------------ | ------------- | ------ |
| `<`, `<=`, `>`, `>=` | integer      | integer       | Bool   |
| `==`, `!=`           | integer      | integer       | Bool   |
| `==`, `!=`           | Bool         | Bool          | Bool   |

- Mixed-type integer comparisons are allowed; operand types are checked with the
  same promotion logic used by arithmetic (types can differ as long as both are integers).
- Comparing Bool with an integer → compile error.
- Using `<`, `<=`, `>`, `>=` on Bool operands → compile error.

## Precedence (highest to lowest)

```
!           (unary, right-assoc)
* /         (left-assoc)
+ -         (left-assoc)
< <= == >= > !=  (left, single — no chaining)
&&          (left-assoc)
||          (left-assoc)
```

## Code generation

Comparison operators map 1-to-1 to JS operators: `<`, `<=`, `===`, `>=`, `>`, `!==`.

Note: Tuff `==` compiles to JS `===` and `!=` compiles to JS `!==`.

## Error cases

- `true < false` → `Type error: < requires integer operands`
- `1U8 == true` → `Type error: cannot compare Bool with integer`
- `a < b < c` → natural type error (left operand of second `<` is Bool)
