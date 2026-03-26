# 19 Char Type

## Objective

Introduce support for the `Char` type and corresponding simple ASCII character literals natively into the Tuff programming language.

## User Stories

- **US1**: As a developer, I want to define simple characters using `'a'` syntax, so I avoid using raw integers for textual context.
- **US2**: As a developer, I want basic character escape sequences (`\n`, `\t`, `\r`, `\0`, `\\`, and `\'`) for specialized whitespace/signals.
- **US3**: As a compiler purist, I want to prevent runtime errors by forbidding accidental char arithmetic (like `'a' + 'b'`).
- **US4**: As a developer, I need characters to be conditionally comparable (`'z' > 'a'`) without triggering typing errors.
- **US5**: As a Tuff writer, I expect attempting to assign a character literal directly to an integer binding (`let x: U8 = 'a'`) to fail explicitly.

## Requirements & Constraints

- **Encoding Limit**: Support standard UTF-8 underlying structure but explicitly refuse values `>= 128` (Strictly ASCII-only for now).
- **Literals**: Character literals are bracketed strictly by single quotes (`'`). Invalid quotes or multiple characters (e.g. `'ab'`) trigger syntax or lexical errors.
- **Strict Typing**:
  - `Char` is a native primitive type.
  - Refuse implicit compatibility between `Char` and `IntSuffix` wrappers (`U8`, `I32`, etc.).
  - No explicit casting exists currently; casting characters to integers is strictly blocked until explicit casting language features are implemented.
- **Supported Operations**:
  - Arithmetic operations (`+`, `-`, `*`, `/`) are strictly **forbidden**.
  - Equality (`==`, `!=`) and Inequality (`<`, `>`, `<=`, `>=`) are **permitted** between `Char` operands.

## Error Cases

- Exceeding character bound (Non-ASCII, length > 1) -> Compile Error.
- Invalid escape sequences (`\x`) -> Compile Error.
- Arithmetic on `Char` -> Type Error.
- Implicit casting `Char` to numeric binding -> Type Error.
