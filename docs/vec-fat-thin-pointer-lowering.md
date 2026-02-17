# Vec / Array Pointer Lowering Contract

This document freezes the pointer-shape lowering law used by the compiler and stdlib migration.

## Pointer shapes

- `*[T]` is a **fat pointer shape** with runtime metadata:
  - `data` pointer
  - `init` initialized element count
  - `length` capacity
- `*[T; Init; Length]` is a **thin pointer shape** (raw pointer only), because `Init` and `Length` are compile-time constants.

## Semantics

- `init` is initialized elements.
- `length` is total capacity.
- Invariants: `0 <= init <= length`.

## Typechecker expectations

- `.init` / `.length` are valid on array-pointer shapes.
- For thin pointers (`*[T;I;L]`), `.init` and `.length` are compile-time constants.
- For fat pointers (`*[T]`), `.init` and `.length` are runtime values.

## Vec direction

`Vec<T>` will be implemented in Tuff contracts using internal `*mut [T]` storage semantics and monomorphized APIs.
