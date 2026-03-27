# Spec 2: Binary Expression

## Syntax

```
binary_expr = operand WS op WS operand
operand     = read_expr | numeric_suffix_literal
op          = "+" | "-" | "*" | "/"
```

Exactly one space must appear on each side of the operator.

## Operand forms

| Form                   | Example         |
| ---------------------- | --------------- |
| Numeric suffix literal | `50U8`, `-30I8` |
| Read expression        | `read<U8>()`    |

## Operators

`+`, `-`, `*`, `/` (all four arithmetic operators).

## Type widening rules

When both operands share the same type, the result has that type.

When operands have **different types of the same signedness**, the result is the larger type:

- `U8 + U16 → U16`
- `I8 + I32 → I32`

When operands have **mixed signedness**, the result is the smallest signed type whose maximum value is greater than `2^(unsigned_bits) - 1`, but at least as large as the existing signed type:

- `I8 + U8 → I16` (I16 max = 32767 > U8 max = 255)
- `I16 + U8 → I16` (I16 already contains full U8 range)
- `I8 + U32 → I64`
- `I64 + U32 → I64`
- `I_n + U64 → compile error` (no signed 128-bit type available)
- `U64 + I_n → compile error` (same reason)

## Compile-time overflow check

When **both** operands are numeric suffix literals (no `read<T>()`), the compiler evaluates the result value. If the result falls outside the range of the result type, a compile error is emitted.

This check applies to `+`, `-`, `*`. For `/`, a division-by-zero check is applied instead.

## Execution environment contract

Generated TypeScript is an IIFE that returns the result type's JS representation:

- Non-bigint suffixes (U8/U16/U32/I8/I16/I32): returns `number`
- Bigint suffixes (U64/I64): returns `bigint`

When the result type is `bigint`, literal operands are emitted as bigint literals (`50n`) and `read<T>()` operands are cast with `BigInt(__tuff_stdin())`.

## Examples

| Tuff expression           | stdin   | Result                                  |
| ------------------------- | ------- | --------------------------------------- |
| `read<U8>() + 50U8`       | `"100"` | `150`                                   |
| `read<U8>() - 50U8`       | `"100"` | `50`                                    |
| `read<U16>() * 2U16`      | `"10"`  | `20`                                    |
| `read<U16>() / 2U16`      | `"100"` | `50`                                    |
| `200U16 + read<U8>()`     | `"50"`  | `250`                                   |
| `read<U8>() + read<U8>()` | `"100"` | `200`                                   |
| `read<U8>() + 1000U16`    | `"100"` | `1100` (widen U8+U16→U16)               |
| `read<I8>() + 10U8`       | `"-50"` | `-40` (widen I8+U8→I16)                 |
| `100U8 + 100U8`           | —       | `200` (compile-time check: in range)    |
| `read<U8>() + 100U64`     | `"50"`  | `150n` (widen U8+U64→U64)               |
| `200U8 + 100U8`           | —       | Compile error: 300 out of range for U8  |
| `100U8 - 200U8`           | —       | Compile error: -100 out of range for U8 |
| `read<U64>() + 50I8`      | —       | Compile error: incompatible types       |
