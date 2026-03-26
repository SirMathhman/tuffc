# evaluateTuff behavior

## Goal

Provide a function that compiles Tuff source to TypeScript, compiles that TypeScript to JavaScript, executes the JavaScript, and returns a number.

## Confirmed behavior

- `evaluateTuff("100U8")` should produce `100`.
- The compile step should happen first, before TypeScript-to-JavaScript compilation.
- Whitespace around the literal should be accepted.
- Signed unsigned literals such as `-1U8` and `+1U8` should be rejected with `RangeError`.
- U8 values above `255` such as `256U8` and `999U8` should be rejected with `RangeError`.
- Invalid or unsupported input should cause an error.
- The public return type remains `number`.

## User stories

- As a developer, I want Tuff numeric literals such as `100U8` to evaluate to their numeric value so that I can run simple programs.
- As a developer, I want surrounding whitespace to be ignored so that formatting does not change program behavior.
- As a developer, I want signed unsigned literals to fail with `RangeError` so that the evaluator enforces unsigned-only semantics.
- As a developer, I want U8 values above 255 to fail with `RangeError` so that the evaluator respects the type width.
- As a developer, I want invalid Tuff input to fail loudly so that bugs are not hidden behind fallback values.
- As a developer, I want the evaluator to always return a `number` so that downstream code has a stable contract.
