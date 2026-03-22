# Arithmetic and Generic Reads

Extends the earlier literal and read specifications with basic arithmetic and
type-generic input handling.

## User stories

- As a caller, I want to combine numeric expressions with `+`, `-`, `*`, and
  `/` so I can compute results in Tuff.
- As a caller, I want arithmetic precedence and grouping to behave normally so
  expressions remain readable.
- As a caller, I want `read<T>()` to work for numeric types so input can flow
  into typed expressions.
- As a caller, I want stdin to be tokenized by whitespace so I can provide
  multiple inputs such as `100 200`.
- As a caller, I want arithmetic overflow, division by zero, and invalid input
  combinations to fail clearly so mistakes are not silently ignored.

## Scope

- Arithmetic is supported for the numeric types already covered by the literal
  spec: `U8`, `U16`, `U32`, `U64`, `I8`, `I16`, `I32`, `I64`, `F32`, and
  `F64`.
- Supported operators are `+`, `-`, `*`, and `/`.
- Parentheses are supported for grouping.
- Unary minus is supported.
- `read<T>()` is supported for all numeric types.
- Stdin is read as whitespace-separated tokens.
- Integer division truncates toward zero and remains integer-valued.
- Arithmetic overflow and division by zero are errors.
- Mixed integer/float expressions are allowed, with float promotion when a
  float is involved.
