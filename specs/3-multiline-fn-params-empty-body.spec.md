# Spec 3: Multi-line fn/out fn with parameters and empty body

## Problem

`parseMultiLineFunctionDefinition` only accepts `fn name() => {` (no params,
no `out` keyword). The new `main.tuff` uses:

- `out fn compileTuffToJS(source) => {` (`out` prefix + parameter)
- Empty body (whitespace only)

## Feature

### Parameters in multi-line function header

`fn name(p1, p2, ...) => {` — zero or more comma-separated identifiers.

### `out` prefix

`out fn name(...) => {` is equivalent to `fn` at compile time for multi-line
blocks (the `out` export signal is only meaningful in the module system context,
not in standalone compileTuffToJS output).

### Empty function body

A body with only whitespace compiles to a no-op (no return statement).
Previous behaviour: empty body threw.
New behaviour: empty body is valid; `bodyLines.length === 0` → `""`.

## Compiled output examples

```
fn get() => {         →  function get() { }

}

out fn f(a, b) => {   →  function f(a, b) { return a; }
    return a;
}
```

## Scope

- Zero or more params, comma-separated valid identifiers.
- Invalid param identifier → compile error.
- Both `fn` and `out fn` valid as non-final blocks.
