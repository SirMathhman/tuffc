# 2 — read<U8>() stdin

## Objective

Support stdin-backed read expression so:

- `executeTuff("read<U8>()", "100")` returns `100`

## User Stories

- As a Tuff user, I want `read<U8>()` to read from stdin so programs can consume input.
- As a runtime, I want only `executeTuff` to receive stdin while `compileTuffToTS` remains source-only.

## Behavior

- `compileTuffToTS("read<U8>()")` is supported and returns TypeScript code that reads stdin at runtime.
- `executeTuff(source, stdIn)` accepts a second parameter `stdIn`.
- For `read<U8>()`, runtime reads the **first whitespace-delimited token** from stdin.
- Input is assumed valid by caller (per product direction), but implementation should still avoid crashes.

## Constraints

- Do **not** add stdin parameter to `compileTuffToTS`.
- Preserve existing integer literal behavior.

## Out of Scope

- Multi-read expressions.
- Other read types (I8, U16, etc.).
