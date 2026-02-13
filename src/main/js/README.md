# Stage 0 Bootstrap Compiler

This folder contains the canonical JavaScript bootstrap compiler implementation.

- Entry CLI: `src/main/js/cli.js`
- Main pipeline: `src/main/js/compiler.js`
- Frontend passes: lexer/parser/desugar/resolve/typecheck
- Diagnostics + lint: `errors.js`, `linter.js`
