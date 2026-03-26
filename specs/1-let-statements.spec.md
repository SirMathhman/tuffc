# let statement behavior

## Goal

Support top-level `let` statements in Tuff programs so values can be bound to names and then reused in a final expression, while preserving the existing integer, `read<T>()`, and arithmetic behavior.

## Confirmed behavior

- Programs should support top-level declarations in the form `let name = expr;` and `let name: Type = expr;`.
- Declarations should use simple ASCII identifiers such as `x`, `total`, and `value2`.
- Reserved syntax such as `let` should not be usable as an identifier name.
- Only declarations should be supported in this iteration; reassignment should not be supported.
- Only a single top-level scope should be supported in this iteration.
- Initializers may use existing supported expressions, including integer literals, `read<T>()`, parentheses, unary operators, and arithmetic operators.
- Bare integer literals such as `100` should be valid inside `let` initializers.
- Existing suffixed integer literals such as `100U8` and `-1I32` should remain valid inside `let` initializers.
- A declaration with a type annotation should validate the initializer against that annotated type and throw an error on mismatch.
- A declaration without a type annotation should infer its type from the initializer.
- Programs may contain one or more declarations followed by a final expression, such as `let x: I32 = 100; x`, and should evaluate to the value of that final expression.
- Programs containing only declarations, such as `let x: U8 = 100U8;` or `let x = 100U8;`, should be valid and should evaluate to `0`.
- Declarations must be terminated by a semicolon; a trailing declaration without a semicolon should be invalid.
- The final expression, when present, should not require a trailing semicolon.
- Variables declared with `let` should be usable by name in later declarations and in the final expression.
- Invalid programs or invalid type/range combinations should fail loudly rather than silently coercing values.

## User stories

- As a developer, I want to declare a named value with `let` so that I can reuse intermediate results in a Tuff program.
- As a developer, I want optional type annotations on `let` declarations so that I can either state the intended type explicitly or rely on inference.
- As a developer, I want annotated declarations to reject incompatible initializer values so that type mistakes are caught early.
- As a developer, I want declaration-only programs to remain valid and return `0` so that setup-only snippets have a defined result.
- As a developer, I want later declarations and the final expression to reference earlier bindings so that simple multi-step programs are possible.
- As a developer, I want unsupported constructs such as reassignment or unterminated declarations to fail clearly so that the language remains predictable in this first version.
