# Spec 3: Arithmetic expressions

## Overview

Tuff supports binary arithmetic over integer literals and `read<T>()` calls.
This iteration introduces a proper expression parser replacing the previous
single-token regex dispatch.

## Grammar

```
program        := expression
expression     := additive
additive       := multiplicative (('+' | '-') multiplicative)*
multiplicative := atom (('*' | '/') atom)*
atom           := integer_literal | read_call
integer_literal := '-'? DIGITS suffix?
suffix         := 'U8' | 'I8' | 'U16' | 'I16' | 'U32' | 'I32' | 'U64' | 'I64'
read_call      := 'read' '<' suffix '>' '(' ')'
```

## Operator precedence

Standard math precedence: `*` and `/` bind tighter than `+` and `-`.
All operators are left-associative.

## Operand types

Operands may have different integer types. Mixed-type arithmetic is allowed;
the result type is not tracked (out of scope for this iteration).

## Compile-time validation

- Integer literal value must be in range for its declared suffix (or I32 if bare).
- Non-integer literals (containing `.`) produce a syntax error (`.` is not a
  recognised character).
- Unknown type suffix produces a syntax error.
- Trailing/orphaned tokens produce a syntax error.
- Unrecognised characters produce a syntax error.

## Runtime

No runtime validation. Division by zero and overflow are undefined behaviour.

## Test harness stdin protocol

`expectTuff(source, stdin, exitCode)` — stdin is a space-separated list of
integers. Each `read<T>()` call consumes the next token, parsed with
`parseInt(token, 10)`.

## Examples

| Tuff source                            | stdin     | result |
| -------------------------------------- | --------- | ------ |
| `read<U8>() + read<U8>()`              | `"1 2"`   | `3`    |
| `read<U8>() - read<U8>()`              | `"5 3"`   | `2`    |
| `read<U8>() * read<U8>()`              | `"4 3"`   | `12`   |
| `read<U8>() / read<U8>()`              | `"12 3"`  | `4`    |
| `read<U8>() + read<U8>() + read<U8>()` | `"1 2 3"` | `6`    |
| `2 + read<U8>() * read<U8>()`          | `"3 4"`   | `14`   |
| `read<U8>() + 5U8`                     | `"3"`     | `8`    |
| `3 + 5`                                | —         | `8`    |
