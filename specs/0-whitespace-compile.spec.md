# Spec 0: Whitespace Compilation

## Objective

Whitespace-only Tuff source code (including the empty string, spaces, tabs, and newlines) must
compile to a program that:

1. Passes ESLint with the project's config (no lint errors)
2. Exits with code 0 when run via `bun --eval`

## User Stories

- As a compiler user, I want empty input to compile to valid, runnable TypeScript so that a
  blank file is treated as a legal, no-op program.
- As a compiler user, I want whitespace-only input (spaces, tabs, newlines) to produce the
  same result as empty input so that indentation and blank lines are never considered syntax.

## Scope

### In scope

- Empty string input (`""`)
- Single space (`" "`)
- Mixed whitespace (`"\t\n  "`)

### Out of scope

- Unicode whitespace (e.g. non-breaking space U+00A0)
- Whitespace embedded within non-whitespace tokens
- What the compiled TypeScript output looks like internally (only observable behaviour matters)

## Constraints

- The compiled output must pass lint (no explicit-type errors, no other rule violations)
- The compiled output, when evaluated by Bun, must exit with code 0
