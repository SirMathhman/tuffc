# 3 — read<U8>() + read<U8>()

## Objective

Support addition of two stdin reads so:

- `executeTuff("read<U8>() + read<U8>()", "100 50")` returns `150`.

## User Stories

- As a Tuff user, I want to add two read expressions so stdin-driven arithmetic is possible.
- As a runtime consumer, I want reads to consume tokens left-to-right.

## Behavior

- Supported expression forms:
  - `read<U8>() + read<U8>()`
  - `read<U8>()+read<U8>()`
- Runtime tokenization is whitespace-delimited.
- First `read<U8>()` consumes first token, second consumes second token.
- Sum is used as process exit value.
- If sum exceeds platform exit width, OS/runtime truncation is acceptable.

## Constraints

- Keep `compileTuffToTS(source)` source-only (no stdin parameter).
- Continue using `executeTuff(source, stdIn)` for runtime input.

## Out of Scope

- More than two read terms.
- Operator precedence beyond this exact two-term addition form.
