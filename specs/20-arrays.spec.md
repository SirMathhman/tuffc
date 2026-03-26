# 20 Array Support

## Objective

Introduce fixed-length arrays to Tuff with strict compile-time types, supporting initialization by element lists, repetitive values, or generator functions, along with bracket-based indexing and assignments.

## User Stories

- **US1**: As a developer, I want to declare variables with an array type like `[U8; 5]` so I know its shape and exact fixed size.
- **US2**: As a developer, I want to instantiate arrays using explicit lists of items like `[1, 2, 3]` so I easily seed simple structures.
- **US3**: As a developer, I want to instantiate arrays using generators via `[func; Length]` where `func` is a 0-argument function pointer giving me dynamically populated structures without loops.
- **US4**: As a developer, I want to initialize arrays with the same repeating scalar/expression via `[0; 10]` to quickly buffer space.
- **US5**: As a developer, I want to read out elements via indexing (`arr[0]`) to retrieve items algorithmically.
- **US6**: As a developer, I want to mutate arrays using assignments (`arr[0] = 5`) to update values in-place over time.

## Requirements & Constraints

- **Type Syntax**: `[Type; N]` where `T` is a TuffType and `N` is an integer literal. This is introduced into the compiler as an `ArrayType` interface containing the base type and a `length: number` property.
- **Initializers**:
  - `[e1, e2, ...]`: Emits `[e1, e2, ...]` in JS. Inferred type matches the common type of the items, length is element count.
  - `[expr; N]`:
    - Case A: `expr` is of type `FunctionPointer` returning `T` with `0` parameters. Evaluates `expr` `N` times. Transpiled to `Array.from({length: N}, expr)`. Emits `[T; N]`.
    - Case B: `expr` is anything else. Transpiled to `Array(N).fill(expr)`. Emits `[Type; N]`.
  - Compile error on mixed initialization syntaxes or unexpected token `N` (Must be an integer literal > 0).
- **Indexing and Assignment**:
  - Requires bracket tokens: `LBRACKET` (`[`), `RBRACKET` (`]`).
  - Index must be an integer compatible type.
  - Reading `arr[i]` returns the base `Type`.
  - Writing `arr[i] = val` requires `val` to be mutually compatible with the array's base `Type`.
  - Arrays do _not_ automatically bounds-check at compile time (JS native bounds apply at runtime, meaning `undefined` behavior on bounds violation might occur native to JS, but typing logic stays clean).

## Error Cases

- Array definition contains a non-integer length (`[U8; "foo"]`).
- Missing semicolons or bad bounds during type definition/expression initialization (`[func; ]`).
- `[expr; N]` where `N` is not directly determinable as an integer literal constraint.
- Indexing into a non-Array type `5[0]`.
- Array element assignments of the wrong type mapping (`arr[0] = "string"` into a `[U8; 10]`).
- Array initialization list mixes non-compatible items (`[1U8, true]`).
