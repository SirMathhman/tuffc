# Runtime Migration Plan: Transition from `tuff_runtime.c`

_Date: 2026-02-16_

This document captures the active migration direction for moving runtime functionality from hand-written C (`src/main/c/tuff_runtime.c`) to Tuff-defined platform libraries.

## Target end-state

- No `tuff_runtime.c` or `tuff_runtime.h` as required runtime artifacts.
- C target runtime is expressed via Tuff libraries using `expect` / `actual`.
- Correctness parity is prioritized over deletion speed.

## Current migration policy (active)

- Use a **transitional dual-runtime** path while parity is being built.
- Keep `src/main/c/tuff_runtime.c` + `src/main/c/tuff_runtime.h` as required runtime artifacts for current native C execution.
- Move behavior by capability groups into `expect/actual` target libraries with explicit verification gates.
- Defer removal of C runtime artifacts until all checkpoints are satisfied.

## Architectural decisions

1. **Target package realization model**
   - `tuff-core` defines cross-platform `expect` APIs/types.
   - Target packages (`tuff-c`, `tuff-js`, etc.) provide `actual` implementations.
   - Compiler must resolve imports against a target-specific package mapping.

2. **Whole-program monomorphization for C**
   - Concrete instantiations of generic containers/helpers are emitted for the C build graph.

3. **Deterministic ownership in C**
   - Destructors/drop semantics are enforced at scope-end/overwrite/return consistently.

4. **FFI passthrough model**
   - `extern let` + `extern fn` lower directly to target ABI symbols/includes.

5. **String ABI direction**
   - `*Str` lowers to `char*`.
   - `Str[L]` lowers to fixed-size `char[L]` at the ABI boundary.

## Milestone 1 (completed)

Introduce target-aware package alias resolution in Stage0 module loading:

- Add target-aware alias mapping in module graph resolution.
- Allow import paths like `tuff-core::collect::Vec` to resolve to target packages.
- Keep current behavior unchanged when no alias mapping is provided.

### Proposed options shape

```ts
compileFileResult(entry, out, {
  enableModules: true,
  target: "c",
  modules: {
    moduleBaseDir: "...",
    packageAliases: {
      tuff_core: "libs/tuff-core",
    },
    packageAliasesByTarget: {
      c: {
        tuff_core: "libs/tuff-c",
      },
      js: {
        tuff_core: "libs/tuff-js",
      },
    },
  },
});
```

Resolution precedence:

1. `packageAliasesByTarget[target][head]`
2. `packageAliases[head]`
3. default `moduleBaseDir/head/...`

## Acceptance criteria for Milestone 1

- Existing module tests continue passing unchanged.
- New focused test proves target-specific alias mapping works.
- Behavior is backward-compatible when alias config is omitted.

Status: ✅ completed (`src/test/js/module-package-aliases.ts`).

## Milestone 2 (in progress): capability-group runtime alignment

Capability groups and baseline coverage are tracked in `docs/runtime-abi-matrix.md`.

Current gates:

- Strings / Collections / IO smoke coverage in C backend checks.
- Expect/actual target-alias pairing checks for C target.
- Native CLI end-to-end C build/run gate.

Implemented verification commands:

- `npm run c:verify`
- `npm run expect:actual:verify`
- `npm run c:native:verify`
- `npm run c:verify:full`

## Milestone 3 (completed): parser/runtime topology prep for multiplatform stdlib

- Added Stage0 parser support for `out module Name { ... }` declaration groups (flattened declaration semantics).
- Added default runtime package alias topology in compiler resolution:
  - base: `tuff_core -> src/main/tuff-core`
  - target `c`: `tuff_core -> src/main/tuff-c`
  - target `js`: `tuff_core -> src/main/tuff-js`
- Kept explicit user alias config as highest precedence to preserve test harness overrides.
- Added regression: `src/test/js/runtime-package-default-aliases.ts`.

Status: ✅ completed.

## Milestone 4 (completed): capability module split + substrate boundary naming

- Added capability modules across runtime packages:
  - `Strings.tuff`
  - `Collections.tuff`
  for `tuff-core`, `tuff-c`, and `tuff-js`.
- Updated default alias regression to import and exercise `tuff_core::Strings` + `tuff_core::Collections`.
- Renamed C codegen dependency to substrate-oriented API:
  - `getEmbeddedCSubstrateSupport` (compat wrapper retained for `getEmbeddedCRuntimeSupport`).

Status: ✅ completed.

## Capability cutover checkpoints

Each runtime capability group may move from transitional `tuff_runtime.*` ownership to target-library ownership only when all of the following are true:

1. **Contract parity**: expect/actual signatures and semantics are validated for the group.
2. **Codegen parity**: generated C paths using that group pass targeted and aggregate verification.
3. **Diagnostics parity**: errors remain actionable and stable.
4. **Regression safety**: existing C verification suites remain green.

## Final removal gate

Remove `tuff_runtime.c/.h` only after:

- capability-group checkpoints pass for all required runtime surfaces,
- native C workflows are stable without direct dependency on transitional runtime symbols, and
- selfhost-C progress gates no longer require transitional runtime artifacts.

## Historical note

Earlier drafts specified immediate removal and no dual-runtime transition. Current implementation intentionally uses a transitional path to reduce risk while expanding C-target parity and verification coverage.
