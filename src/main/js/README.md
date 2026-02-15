# Stage 0 Bootstrap Compiler

This folder contains the canonical TypeScript bootstrap compiler implementation.

- Entry CLI: `src/main/js/cli.ts`
- Main pipeline: `src/main/js/compiler.ts`
- Frontend passes: lexer/parser/desugar/resolve/typecheck
- Diagnostics: `errors.ts`

## Backend modes

- `selfhost` (CLI default when safe): routes compile operations through `src/main/tuff/selfhost.tuff`
  (bootstrapped lazily by Stage 0).
- `stage0`: canonical JavaScript bootstrap pipeline.

CLI usage:

- `tuff compile input.tuff --selfhost`
- `tuff compile input.tuff --stage0`

Notes:

- Linting is selfhost-only. `--lint` with `--stage0` now reports
  `E_SELFHOST_UNSUPPORTED_OPTION`.
- `--lint-fix` is currently unsupported in selfhost mode and reports
  `E_SELFHOST_UNSUPPORTED_OPTION`.
