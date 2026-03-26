# Spec 2: `read<T>()` built-in function

## Overview

`read<T>()` is a built-in Tuff expression that reads a single value from stdin
and returns it as an integer of the specified type. For testing purposes it is
injected as a mock function parameter rather than performing real I/O.

## Behaviour

- `read<T>()` is a **complete, standalone Tuff program** (no composition with
  other expressions in this iteration).
- The type parameter `T` must be one of the 8 known integer suffixes:
  `U8`, `I8`, `U16`, `I16`, `U32`, `I32`, `U64`, `I64`.
- The compiled TypeScript output delegates to an injected `read` function:
  `return read();`
- Runtime range validation and stdin parsing are **out of scope** – the
  generated code trusts the caller to supply a valid integer.
- Out-of-range or non-integer stdin values are **undefined behaviour**.

## Valid inputs

| Tuff source    | Compiled TypeScript |
|----------------|---------------------|
| `read<U8>()`   | `return read();`    |
| `read<I8>()`   | `return read();`    |
| `read<U16>()`  | `return read();`    |
| `read<I16>()`  | `return read();`    |
| `read<U32>()`  | `return read();`    |
| `read<I32>()`  | `return read();`    |
| `read<U64>()`  | `return read();`    |
| `read<I64>()`  | `return read();`    |

## Invalid inputs (compile error)

| Tuff source      | Reason                  |
|------------------|-------------------------|
| `read<U9>()`     | Unknown type suffix     |
| `read<>()`       | Empty type parameter    |
| `read()`         | Missing type parameter  |
| `read<U8>(foo)`  | Arguments not allowed   |

## Test harness contract

`expectTuff(source, stdin, exitCode)` — three-argument form.

The harness parses `stdin` with `parseInt(stdin, 10)`, passes it as `read`
via `new Function("read", tsCode)(mockRead)`, and asserts on the return value.

The two-argument form `expectTuff(source, exitCode)` remains for programs that
don't use `read<T>()`.
