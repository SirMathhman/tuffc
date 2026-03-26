# Spec 17: Type Aliases and the `is` Operator

## Summary

Two new features:

1. **Type aliases** — `type Name = SomeType;` binds a name to a resolved type.
2. **`is` operator** — `expr is Type` checks whether the expression's compile-time type matches, returning `Bool`.

---

## Type Aliases

### Grammar

```
TypeAliasDecl = "type" NAME "=" Type ";"
```

A type alias can appear **anywhere a statement can appear**: at the top level, before or after `fn` declarations, inside function bodies, and inside block expressions.

### Semantics

- Aliases are resolved **eagerly and transitively** at declaration time: the resolved `TuffType` is stored, not the syntax.
- Aliases can reference previously-defined aliases: `type A = I32; type B = A;` — `B` resolves to `I32`.
- Aliases may refer to any `TuffType`: primitive, pointer, function pointer, or another alias.
- Aliases **cannot** be recursive: e.g. `type A = *A;` is an error because `A` has not been defined yet.
- Declaring the same alias name twice is a **duplicate alias error**.
- Aliases **shadow** built-in type names (e.g. `type I32 = Bool`) is an error — built-in names cannot be used as alias names.
- Type alias declarations emit **no JavaScript** — they are purely compile-time constructs.

### Usage

- Aliases can be used in `let` type annotations: `let x: Num = 5;`
- Aliases can be used in function parameter types: `fn foo(x: Num): Num => x`
- Aliases can be used in pointer/FP types: `*(Num) => Num`, `*Num`
- Aliases can be used on the right side of `is`

### Error Cases

| Input                              | Error                                           |
| ---------------------------------- | ----------------------------------------------- |
| `type Foo = I32; type Foo = Bool;` | duplicate type alias 'Foo'                      |
| `type A = A;`                      | unknown / expected type (alias not yet defined) |
| `type I32 = Bool;`                 | cannot shadow built-in type 'I32'               |

---

## The `is` Operator

### Grammar

```
IsExpr = Expr "is" Type
```

`is` has the **same precedence as comparisons** (`==`, `!=`, `<`, `<=`, `>`, `>=`). It does not chain with other comparisons in the same expression position.

### Semantics

- Evaluates the left-hand expression (which may have side effects).
- Compares the expression's **compile-time type** to the given type using `typesEqual`.
- Returns **`Bool`**: `true` if the types match, `false` otherwise.
- The alias on the right-hand side is resolved before comparison.
- Since Tuff is statically typed today, the result is always a compile-time constant. The expression is still evaluated for side effects.
- Code emission: `(expr_code, true)` or `(expr_code, false)` using JS comma operator.

### Valid Examples

| Expression                  | Result      |
| --------------------------- | ----------- |
| `42 is I32`                 | `1` (true)  |
| `42 is Bool`                | `0` (false) |
| `true is Bool`              | `1`         |
| `true is I32`               | `0`         |
| `type Num = I32; 42 is Num` | `1`         |

### Error Cases

| Input           | Error                         |
| --------------- | ----------------------------- |
| `42 is Void`    | cannot use `is` with `Void`   |
| `42 is Unknown` | expected type … got "Unknown" |

---

## Implementation Notes

### `typeAliasEnv`

A `Map<string, TuffType>` declared inside `parseProgram`. Not block-scoped — any alias declared anywhere is globally visible from that point forward (simple model for now).

### Pass 1 changes

`collectFunctionSignatures` must also handle `type` declarations so that aliases defined before functions are available when parsing function signatures.

### Pass 2 changes

Top-level loop must handle interleaved `fn` and `type` declarations.

### `expectType` changes

After checking for `*`, when a `NAME` token is encountered, check `typeAliasEnv` before `VALID_TYPES`.

### `parseCmp` changes

After `parseAdd()`, before checking `CMP_OPS`, check for `NAME` token with value `"is"`.
