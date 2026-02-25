# AST to Tuff Emission Contract (Phase 1)

This document defines the implementation contract for emitting canonical `.tuff` from the typed/resolved AST while preserving source trivia (comments/blank lines) and enabling deterministic lint auto-fix.

## 1) Canonical output contract

- Output is syntactically valid `.tuff` for all supported AST kinds.
- Emission is deterministic: identical AST + trivia input yields byte-identical output.
- Output is idempotent under the same emitter version.
- Unsupported node kinds must fail with informative diagnostics (no silent drops).

## 2) Trivia preservation contract

The emitter must preserve:

- file header comments/license preamble,
- leading comments on declarations/statements,
- trailing inline comments,
- block comments,
- intentional blank line separation between top-level declarations.

When typed/resolved normalization changes ordering or shape, trivia attachment uses stable anchors and applies these fallbacks:

1. exact anchor placement,
2. nearest surviving sibling anchor,
3. enclosing block anchor,
4. file-level append as last resort.

## 3) Lint-fix contract (safe subset)

- v1 enables only deterministic and non-overlapping fixes.
- Fix application must be atomic (all-or-nothing per file).
- Applied/skipped fix accounting is required in compile results.
- If fix conflict is detected, emit diagnostics and do not partially rewrite.

## 4) CLI/target contract

- `--target tuff` must be accepted end-to-end.
- Default output extension for `--target tuff` is `.tuff`.
- Native build flags remain valid only for `--target c`.

## 5) Verification contract

Required checks:

- golden snapshots for emitted `.tuff`,
- comment/trivia preservation fixtures,
- parse -> emit -> parse equivalence checks,
- deterministic lint-fix rewrite tests,
- core suite regression checks.
