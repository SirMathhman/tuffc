# Tuff Stage 0 Bootstrap Compiler (JavaScript)

Implements Phase 1 / Stage 0 from `SELF-HOST.md`:

- Lexer with source positions
- Recursive-descent parser for Tuff-lite
- Desugaring pass (`class fn` support)
- Name resolution with no-shadowing checks
- Basic bidirectional-ish type checking for Tuff-lite
- JavaScript code generation
- CLI: `tuff compile file.tuff`
- Snapshot and runtime test harness

## Quick start

1. Run tests: `npm test`
2. Compile file: `node ./src/cli.js compile ./tests/cases/factorial.tuff -o ./tests/out/factorial.js`

## Phase 2 / Stage 1

Stage 1 source is in `stage1/compiler.tuff`.

- Stage 0 compiles `stage1/compiler.tuff` to `tests/out/stage1/stage1_a.js`
- `stage1_a.js` then compiles the same Stage 1 source to `stage1_b.js`
- The bootstrap check verifies normalized equivalence between `stage1_a.js` and `stage1_b.js`

Run only Stage 1 bootstrap validation:

- `npm run stage1:bootstrap`

Implementation note:

- Stage 1 runtime hooks are exposed via `__host_*` functions in the bootstrap harness.
- This keeps Stage 1 authored in Tuff-lite while preserving deterministic bootstrap equivalence during Phase 2.
