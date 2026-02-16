# Runtime Migration Plan: Remove `tuff_runtime.c`

_Date: 2026-02-16_

This document captures the agreed direction for fully migrating runtime functionality from hand-written C (`src/main/c/tuff_runtime.c`) to Tuff-defined platform libraries.

## Agreed end-state

- No `tuff_runtime.c` or `tuff_runtime.h` as required runtime artifacts.
- C target runtime is expressed via Tuff libraries using `expect` / `actual`.
- Selfhost C bootstrap is the hard acceptance gate.
- Correctness parity is prioritized over deletion speed.
- No long-running dual-runtime mode; switch should be coherent once ready.

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

## Milestone 1 (starting now)

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

## Overall removal gate

`selfhost C bootstrap passes` with no dependency on `tuff_runtime.c`.
