# Stage 0 Bootstrap Compiler

This folder contains the canonical TypeScript bootstrap compiler implementation.

- Entry CLI: `src/main/js/cli.ts`
- Main pipeline: `src/main/js/compiler.ts`
- Frontend passes: lexer/parser/desugar/resolve/typecheck
- Diagnostics + lint: `errors.ts`, `linter.ts`

## Backend modes

- `selfhost` (CLI default when safe): routes compile operations through `src/main/tuff/selfhost.tuff`
  (bootstrapped lazily by Stage 0).
- `stage0`: canonical JavaScript bootstrap pipeline.

CLI usage:

- `tuff compile input.tuff --selfhost`
- `tuff compile input.tuff --stage0`

Notes:

- CLI auto-falls back to Stage 0 when using `--lint*` or `--trace-passes`.
- Selfhost backend now supports:
  - strict safety division checks (`--stage2`)
  - strict file-length lint enforcement (`E_LINT_FILE_TOO_LONG`) when lint is
    run in error mode via explicit selfhost backend usage.
- Selfhost backend does not yet support Stage 0 lint auto-fix and advanced lint
  diagnostics (unused binding, receiver-call style suggestions, etc.).
