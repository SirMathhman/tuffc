# Stage 0 Bootstrap Compiler

This folder contains the canonical JavaScript bootstrap compiler implementation.

- Entry CLI: `stage0/cli.js`
- Main pipeline: `stage0/compiler.js`
- Frontend passes: lexer/parser/desugar/resolve/typecheck
- Diagnostics + lint: `errors.js`, `linter.js`

`src/` is intentionally kept as compatibility shims that re-export from this folder.
