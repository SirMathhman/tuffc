# Spec 1: read<T>() Expression

## Summary

Tuff exposes a `read<T>()` built-in expression that reads one value from stdin
and returns it typed as `T`.

## Syntax

```
read<U8>()
read<U16>()
read<U32>()
read<U64>()
read<I8>()
read<I16>()
read<I32>()
read<I64>()
```

`T` must be one of the 8 numeric suffix types. No other type argument is valid.

## Semantics

- `read<U8..U32, I8..I32>()` returns a plain JS `number`.
- `read<U64>()` and `read<I64>()` return a JS `BigInt`.
- Stdin is consumed by the surrounding execution environment; the compiler does
  not receive the stdin value.
- Validity of the stdin value (range, format) is undefined behavior — callers
  are responsible for providing valid input.

## Compilation target

`read<U8>()` lowers to:

```typescript
(function (): number {
  return Number(__tuff_stdin());
})();
```

`read<U64>()` lowers to:

```typescript
(function (): bigint {
  return BigInt(__tuff_stdin());
})();
```

The identifier `__tuff_stdin` is injected by the execution environment at
runtime as a `() => string` function parameter — it is never part of compiler
output except as a call site.

## Execution environment contract

The executor must pass a `() => string` function as the `__tuff_stdin`
argument to the compiled function. In the test harness this is done via:

```typescript
new Function("__tuff_stdin", "return " + jsCode)(stdinFn);
```

where `stdinFn = () => stdIn`.
