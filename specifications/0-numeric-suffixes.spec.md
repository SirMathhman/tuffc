# Tuff Numeric Suffix Literals

## Summary

Tuff supports typed integer literals with a suffix denoting their type.

## Syntax

`<integer><suffix>` where suffix is one of: `U8`, `U16`, `U32`, `U64`, `I8`, `I16`, `I32`, `I64`

## Semantics

- The suffix is a compile-time type annotation only.
- The value is validated at compile time (in `compileTuffToTS`); out-of-range values are a compile error.
- U64 and I64 compile to a JS BigInt literal (`100n`); all others compile to a plain JS number.

## Ranges

| Suffix | Min         | Max        |
| ------ | ----------- | ---------- |
| U8     | 0           | 255        |
| U16    | 0           | 65535      |
| U32    | 0           | 4294967295 |
| U64    | 0           | 2^64 - 1   |
| I8     | -128        | 127        |
| I16    | -32768      | 32767      |
| I32    | -2147483648 | 2147483647 |
| I64    | -2^63       | 2^63 - 1   |

## User Stories

- As a Tuff programmer, I want to write `100U8` and get back `100` at runtime.
- As a Tuff programmer, I want `256U8` to throw a compile-time error.
- As a Tuff programmer, I want `100U64` to return `100n` (BigInt).
- As a Tuff programmer, I want `-1U8` to throw a compile-time error.

## Scope

- Standalone numeric literals only (not inside larger expressions) for now.
