# 4 — Mixed expressions with read<U8>() and literals

## Objective

Support non-hardcoded expression compilation with mixed term kinds:

- `executeTuff("read<U8>() + 50U8", "100")` => `150`
- `executeTuff("read<U8>() + read<U8>()", "100 50")` => `150`

## User Stories

- As a Tuff user, I want to mix `read<U8>()` and integer literals in arithmetic expressions.
- As a Tuff user, I want operator support for `+`, `-`, `*`, `/`.
- As a Tuff user, I expect standard precedence (`*`/`/` before `+`/`-`).

## Grammar (current scope)

- Expression: `Term (Op Term)*`
- Term: `read<U8>()` | IntegerLiteral
- Op: `+` | `-` | `*` | `/`
- Whitespace: optional around terms/operators

## Semantics

- `read<U8>()` consumes stdin tokens left-to-right, whitespace-delimited.
- Integer literal parsing/range rules remain unchanged.
- `/` uses integer division with truncation toward zero.
- Division-by-zero runtime behavior is intentionally left undefined for now.

## Constraints

- Keep `compileTuffToTS(source)` source-only.
- Runtime stdin comes from `executeTuff(source, stdIn)`.
- No regex/throw/null/type-literal/Record usage constraints remain in force.

## Out of Scope

- Parentheses.
- Non-`read<U8>()` read types.
- Functions or identifiers beyond these term forms.
