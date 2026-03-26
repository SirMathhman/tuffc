# evaluateTuff behavior

## Goal

Provide a function that compiles Tuff source to TypeScript, compiles that TypeScript to JavaScript, executes the JavaScript, and returns a numeric value.

## Confirmed behavior

- `evaluateTuff("100U8")` should produce `100`.
- Integer literals with suffixes `U8`, `U16`, `U32`, `U64`, `I8`, `I16`, `I32`, and `I64` should be supported.
- `read<T>()` should read a textual numeric literal from `stdIn`, validate it against `T`, and return the typed value.
- Addition expressions combining literals and `read<T>()` should be supported, with `stdIn` tokens consumed from left to right.
- The compile step should happen first, before TypeScript-to-JavaScript compilation.
- Whitespace around the literal should be accepted.
- Signed unsigned literals such as `-1U8` and `+1U8` should be rejected with `RangeError`.
- U8 values above `255` such as `256U8` and `999U8` should be rejected with `RangeError`.
- 64-bit literals should evaluate as `bigint` values when needed.
- `read<U64>()` and `read<I64>()` should return `bigint` values when needed.
- `evaluateTuff("read<U8>() + read<U8>() + 3U8", "1 2")` should produce `6`.
- Invalid or unsupported input should cause an error.
- The public return type should be `number | bigint`.

## User stories

- As a developer, I want Tuff numeric literals such as `100U8` to evaluate to their numeric value so that I can run simple programs.
- As a developer, I want all supported integer widths to compile and evaluate so that I can model common fixed-width numeric types.
- As a developer, I want `read<T>()` to parse stdin text so that I can provide runtime input to Tuff programs.
- As a developer, I want surrounding whitespace to be ignored so that formatting does not change program behavior.
- As a developer, I want signed unsigned literals to fail with `RangeError` so that the evaluator enforces unsigned-only semantics.
- As a developer, I want U8 values above 255 to fail with `RangeError` so that the evaluator respects the type width.
- As a developer, I want 64-bit values to use `bigint` so that they can be represented exactly.
- As a developer, I want invalid Tuff input to fail loudly so that bugs are not hidden behind fallback values.
- As a developer, I want the evaluator to always return a `number | bigint` so that downstream code has a stable contract.
