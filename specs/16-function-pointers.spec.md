# Specification 16: Function Pointers

## Iteration Summary

Add function pointer types, allowing functions to be stored in variables, passed as arguments, returned from functions, and called indirectly.

## User Stories

1. As a developer, I want to store a function in a variable so that I can call it later through the variable.
2. As a developer, I want to pass a function as an argument so that I can write higher-order functions.
3. As a developer, I want to return a function pointer from a function so that I can build factories and selectors.
4. As a developer, I want type-checked function pointer calls so that arity and argument types are validated at compile time.
5. As a developer, I want mutable function pointer variables so that I can change which function a variable points to.

## Language Grammar Extensions

### Type Syntax

```
FunctionPointerType ::= "*" "(" TypeList ")" "=>" Type
TypeList            ::= (Type ("," Type)*)?
```

Function pointer types use the `*(params) => ReturnType` syntax:

- `*(I32) => Void` — takes one I32, returns Void
- `*(I32, I32) => I32` — takes two I32s, returns I32
- `*() => Bool` — takes no params, returns Bool
- `*(*(I32) => I32) => I32` — higher-order: takes a function pointer parameter

The `*` in `*(...)` is NOT a pointer dereference operator here — it is the function pointer type sigil. `*mut` is not valid for function pointer types (functions are not memory locations).

### Address-Of for Functions

```
AddressOf ::= "&" NAME
```

- `&funcName` where `funcName` is a declared function → produces a function pointer value
- `&mut funcName` is NOT valid (functions are not mutable memory locations)
- Taking `&` of a variable (existing data pointer behavior) is unchanged

### Function Pointer Call

```
CallExpr ::= NAME "(" ArgList? ")"
```

Calling through a function pointer uses the same call syntax as named functions:

- `fp(arg1, arg2)` — calls function stored in `fp`
- All existing call validation rules apply (arity, argument types)
- Void function pointer calls are valid as statements only (not in expressions)

## Semantics

### Obtaining a Function Pointer

- `&funcName` evaluates to a value of type `*(ParamTypes) => ReturnType` matching the function's signature
- The function must be declared in scope (no dynamic lookup)
- Only named functions can be pointed to (not temporary expressions)

### Storing and Reassigning

- `let fp: *(I32) => I32 = &funcName;` — immutable binding
- `let mut fp = &funcName;` — mutable binding, type inferred from `&funcName`
- `fp = &otherFunc;` — reassignment requires `mut` and matching type (exact match)

### Calling Through a Function Pointer

- `fp(arg)` — calls the function currently stored in `fp`
- Arity is checked against the function pointer type's parameter list
- Each argument must be type-compatible with the corresponding parameter type in the function pointer type
- Void function pointer calls follow the same rules as Void function calls (statement only)

### Type Compatibility

Function pointer types are invariant — both parameter types and return type must match exactly (no promotion). If `fp: *(I32) => I32`, then only `*(I32) => I32` function pointers can be assigned to it.

### Restrictions

- Function pointers cannot be used in arithmetic, boolean operations, or comparisons
- Function pointers cannot appear as the program's final expression
- Cannot take `&mut` of a function name
- Cannot call a non-function-pointer variable as a function

## Type Rules

1. **Address-of function**: `fn f(x: T) : R => ...; let p = &f;` → `p: *(T) => R`
2. **Exact match required**: `let p: *(I32) => Bool = &f;` requires `f: (I32) -> Bool`
3. **Mutable reassignment**: `let mut p = &f; p = &g;` requires `g` has same type as `f`
4. **Call arity**: calling `p(a1, a2)` requires exactly 2 params in `p`'s type
5. **Call argument types**: each `ai` must be assignable to the corresponding parameter type
6. **Void-as-statement**: calling Void function pointer requires semicolon context
7. **No `&mut` on functions**: `&mut funcName` is an error
8. **Non-function-pointer call**: calling variable without function pointer type is an error

## Error Cases

1. `&nonExistentName` — unknown name
2. `&mut funcName` — cannot take mutable address of function
3. `let p: *(I32) => Bool = &f;` where `f: (I32) -> I32` — type mismatch
4. `p(1, 2)` where `p: *(I32) => I32` — wrong arity
5. `p(true)` where `p: *(I32) => I32` — argument type mismatch
6. `let x = 5; x(1)` — calling non-function-pointer variable
7. `let p = &voidFn; let y = p();` — Void function pointer in expression context
8. `p + 1` where `p` is a function pointer — function pointer in arithmetic

## Examples

### Valid

```tuff
fn double(x: I32) : I32 => x * 2;
let op: *(I32) => I32 = &double;
op(21)
```

→ exits 42

```tuff
fn add(x: I32, y: I32) : I32 => x + y;
fn apply(f: *(I32, I32) => I32, a: I32, b: I32) : I32 => f(a, b);
apply(&add, 10, 32)
```

→ exits 42

```tuff
fn noOp() : Void => { };
let action: *() => Void = &noOp;
action();
42
```

→ exits 42

### Invalid

```tuff
fn f(x: I32) : I32 => x;
let p: *(I32) => Bool = &f;   // type mismatch
```

```tuff
fn f(x: I32, y: I32) : I32 => x + y;
let p = &f;
p(1)   // wrong arity
```

## Implementation Notes

### Internal Type Representation

```typescript
type TuffType =
  | PrimitiveType
  | { kind: "Pointer"; mutable: boolean; pointee: TuffType }
  | { kind: "FunctionPointer"; params: TuffType[]; returnType: TuffType };
```

### Code Generation

- `&funcName` → generates `funcName` (the JS function value)
- `fp(arg)` → generates `fp.val(arg)` (call through the wrapper's `.val`)
- Function pointer binding stored in same `{val: fn}` wrapper as other bindings

### Parsing Disambiguation

After consuming `*(`, parse comma-separated types until `)`, then check for `=>`:

- If `=>` follows: emit `FunctionPointerType`
- Otherwise (zero or one type, no `=>`): emit `PointerType` (parenthesized)
- `*mut (...)` always produces a data `PointerType`, never a `FunctionPointerType`
