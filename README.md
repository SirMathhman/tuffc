# Tuff Compiler Toolchain

_Last updated: 2026-02-17_

Native-first, self-hosted Tuff compiler with bootstrap history preserved in-repo. The default execution path is the generated native Stage 3 CLI, with legacy Stage0 TypeScript sources retained only for transitional/testing coverage. See `docs/native-selfhost-transition.md` and `SELF-HOST.md` for roadmap details.

## Current implementation status

| Component                               | Status           | Notes                                                                           |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------- |
| Stage 0 (JS bootstrap, legacy)          | ♻️ Transitional  | Kept for historical/bootstrap references while native-first migration completes |
| Stage 1 (Tuff-lite bootstrap)           | ✅ Complete      | Bootstrap equivalence passes (`stage1:bootstrap`)                               |
| Stage 2 (Full Tuff strict mode)         | ✅ Complete      | Refinement types, ownership, proof checks                                       |
| Stage 3 (Selfhost from `selfhost.tuff`) | ✅ Strong parity | See `docs/stage0-vs-stage3-implementation-status.md`                            |
| C backend                               | 🔄 Active        | M2 capability-group alignment in progress; see `docs/runtime-migration-plan.md` |
| Web bundle                              | ✅ Complete      | `tuff-compiler.esm.js` / `.min.js` for browser use                              |

### Compiler capabilities currently available

- Lexer with source positions
- Recursive-descent parser (Tuff-lite + extensions)
- Desugaring pass (`class fn`, closures, `loop {}`, `object` singletons)
- Name resolution with no-shadowing checks
- Bidirectional type checking with generics
- Borrow checker (move/copy semantics, drop lifecycle, `*move` qualifier)
- JavaScript codegen
- C codegen backend with substrate support unit
- Module graph with target-aware package aliases (`tuff-core`, `tuff-c`, `tuff-js`)
- `contract` / `into` — static dispatch and dynamic dispatch lowering
- `expect` / `actual` declarations for cross-platform stdlib
- `Result` / `Option` with `?` unwrap and pipe-union forms
- Structured 4-part diagnostics (`source`, `cause`, `reason`, `fix`)
- Browser bundle API (`compileTuffToJs`, `compileTuffToJsResult`, `compileTuffToJsDiagnostics`)

### Known gaps (see `GAPS.md` for details)

- `async fn` / CPS surface — not yet parsed
- `class fn` desugar — constructor/return typing mismatch
- Dependent array signature form (`toStackArray`) — not yet resolved
- Diagnostic code name mismatches (`E_SAFETY_OVERFLOW` vs. `E_SAFETY_INTEGER_OVERFLOW`, `E_MATCH_NON_EXHAUSTIVE` vs. `E_TYPE_MATCH_NON_EXHAUSTIVE`)

## Repository layout (Gradle-like, multi-language)

- `src/main/js` — Legacy Stage 0 TypeScript bootstrap/compiler utilities (transitional)
- `src/main/tuff` — Tuff compiler sources (Stage 1 / selfhost stages)
- `src/main/tuff-core` — Cross-platform `expect` API definitions
- `src/main/tuff-c` — C target `actual` implementations
- `src/main/tuff-js` — JS target `actual` implementations
- `src/main/c` — Transitional C runtime (`tuff_runtime.c`, substrate support unit)
- `src/test/js` — JS test harnesses
- `src/test/tuff` — Tuff test programs and module fixtures

## Quick start

> **Note:** Both `npm` and `bun` work interchangeably for all scripts below.

1. Run the fast default test command: `bun run test` (or `npm run test`)
2. Run lint pass: `bun run lint`
3. Run JS throw-ban lint gate: `bun run lint:throws`
4. Run typecheck: `bun run typecheck`
5. Run combined local gate (lint + typecheck + fast tests): `bun run check`
6. Compile file (native default): `npm run native:selfhost:run -- ./src/test/tuff/cases/factorial.tuff -o ./tests/out/factorial.js`

### Test command tiers

- `npm run test` / `npm run test:core` — canonical fast local loop (default).
- `npm run test:native` — C/native validation suite.
- `npm run test:stress` — heavy exhaustive/stress checks.
- `npm run test:all` — runs all tiers in deterministic order.

Native tier policy is fail-hard: if required native toolchain dependencies (for
example `clang`/`gcc`) are missing, native tests fail with actionable guidance
instead of silently skipping.

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

- `npm run native:selfhost:run -- ./src/test/tuff/modules/app.tuff --modules --module-base ./src/test/tuff/modules -o ./tests/out/stage2/app.js`

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

- `npm run native:selfhost:run -- ./tests/out/stage4/cli-fail.tuff --stage2 --json-errors`
- `npm run native:selfhost:run -- ./tests/out/stage4/cli-fail.tuff --lint --json-errors`
- `npm run native:selfhost:run -- ./src/test/tuff/cases/factorial.tuff --trace-passes`

Run Phase 4 verification only:

- `npm run stage4:verify`

## Browser/website tech-demo bundle

You can ship the legacy Stage 0 web compiler bundle and compile Tuff source
directly in a website.

Build outputs:

- IIFE/global bundle: `tests/out/web/tuff-compiler.min.js`
- ESM bundle: `tests/out/web/tuff-compiler.esm.js`

Build commands:

- `npm run build:web`
- `npm run build:web:esm`

API exposed by the bundle:

- `compileTuffToJs(source, options?) -> string`
- `compileTuffToJsResult(source, options?) -> { ok, value | error }`
- `compileTuffToJsDiagnostics(source, options?) -> diagnostic-safe object`

Example (`build:web` global bundle):

```html
<script src="/assets/tuff-compiler.min.js"></script>
<script>
  const tuffCode = `fn main() : I32 => 42;`;
  const jsCode = window.TuffCompiler.compileTuffToJs(tuffCode, {
    typecheck: { strictSafety: true },
    lint: { enabled: true, mode: "warn" },
  });
  console.log(jsCode);
</script>
```

Sanity-check the browser API locally:

- `npm run web:verify`

## Porting policy: no `throw` in compiler code

For Tuff-portability, compiler/runtime implementation code is migrating from exception-based
control flow to `Result<T, E>` values.

- ESLint enforces a throw-ban rule (`ThrowStatement`) across TypeScript sources.
- The throw-ban is enforced across compiler TypeScript sources, including transitional Stage0 code.
- New and migrated code should use helpers in `src/main/js/result.ts` or equivalent selfhost diagnostic/result flows.
