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

## Repository layout (Gradle-like, multi-language)

- `src/main/js` — bootstrap/runtime JavaScript implementation
- `src/main/tuff` — main Tuff compiler sources (self-hosted stages)
- `src/main/rust` — Rust experiments/runtime tooling
- `src/test/js` — JS test harnesses
- `src/test/tuff` — Tuff test programs and module fixtures

## Quick start

1. Run tests: `npm test`
2. Compile file: `node ./src/main/js/cli.js compile ./src/test/tuff/cases/factorial.tuff -o ./tests/out/factorial.js`

## Phase 2 / Stage 1

Stage 1 source is in `src/main/tuff/compiler.tuff`.

- Stage 0 compiles `src/main/tuff/compiler.tuff` to `tests/out/stage1/stage1_a.js`
- `stage1_a.js` then compiles the same Stage 1 source to `stage1_b.js`
- The bootstrap check verifies normalized equivalence between `stage1_a.js` and `stage1_b.js`

Run only Stage 1 bootstrap validation:

- `npm run stage1:bootstrap`

Implementation note:

- Stage 1 runtime hooks are exposed via `__host_*` functions in the bootstrap harness.
- This keeps Stage 1 authored in Tuff-lite while preserving deterministic bootstrap equivalence during Phase 2.

## Phase 3 / Stage 2

Stage 2 capabilities are available in strict mode:

- Refinement type parsing (e.g. `I32 != 0`, `USize < 100`)
- Flow-sensitive narrowing in `if` branches
- Compile-time proof checks for:
  - division/modulo by zero
  - integer overflow/underflow for provable arithmetic ranges
  - array index bounds (when provable)
- Match exhaustiveness checks for union-tag cases
- Module graph loading via `let { ... } = com::path::Module`

CLI options:

- `--stage2` enables strict safety checks
- `--modules` enables module graph loading
- `--module-base <dir>` sets the module root directory

Example:

- `node ./src/main/js/cli.js compile ./src/test/tuff/modules/app.tuff --modules --module-base ./src/test/tuff/modules -o ./tests/out/stage2/app.js`

Run Phase 3 verification only:

- `npm run stage2:verify`

## Phase 4 (current focus)

Production-readiness diagnostics are now available:

- Structured compiler diagnostics with stable error codes
- Four-part diagnostics for every error:
  1. erroneous source excerpt
  2. cause message
  3. semantic reason
  4. concrete fix guidance
- Human-readable CLI diagnostics by default
- Machine-readable diagnostics with `--json-errors`
- Optional lint pass with `--lint`

Example:

- `node ./src/main/js/cli.js compile ./tests/out/stage4/cli-fail.tuff --stage2 --json-errors`
- `node ./src/main/js/cli.js compile ./tests/out/stage4/cli-fail.tuff --lint --json-errors`

Run Phase 4 verification only:

- `npm run stage4:verify`
