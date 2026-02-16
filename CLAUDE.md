# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Tuff** is a statically-typed, compiled programming language designed to be AI-safe by construction — it provides mathematical proof that compiled programs are free from buffer overflows, null dereferences, data races, division by zero, and integer overflow. The language syntax blends TypeScript expressiveness with C performance and Rust memory safety.

This repo contains the Tuff toolchain, currently bootstrapping through two compiler paths:
- **Stage 0** (`src/main/js/`) — the canonical TypeScript bootstrap compiler
- **Selfhost** (`src/main/tuff/`) — the Tuff-in-Tuff self-hosted compiler (Stage 1+)

## Commands

All commands use `bun` (or `npm` as alias):

```bash
# Regression and build
bun run test                   # Full regression suite
bun run build                  # Full bootstrap pipeline

# Targeted verification gates
bun run stage1:bootstrap       # Stage 0→Stage 1→Stage 1 triple-compilation equivalence
bun run stage2:verify          # Refinement type / safety proof checks
bun run stage4:verify          # Production diagnostics 4-part contract
bun run borrow:verify          # Ownership/move semantics
bun run selfhost:parity        # Stage 0 ↔ Selfhost behavioral parity
bun run selfhost:modules       # Module system tests
bun run selfhost:diagnostics   # Diagnostic code consistency
bun run modules:aliases        # Package alias resolution

# Code quality
bun run lint:eslint            # ESLint (no-throw enforcement)
bun run lint:throws            # Fail if any throw statements exist
bun run lint:fix               # Auto-fix lint issues
bun run typecheck              # TypeScript type checking

# Compile a Tuff source file directly
tsx ./src/main/js/cli.ts compile <file.tuff> -o <out.js>
tsx ./src/main/js/cli.ts compile <file.tuff> --stage0 -o <out.js>         # Force Stage 0 path
tsx ./src/main/js/cli.ts compile <file.tuff> --modules --module-base ./src/test/tuff/modules -o <out.js>
tsx ./src/main/js/cli.ts compile <file.tuff> --json-errors --trace-passes -o <out.js>
tsx ./src/main/js/cli.ts compile <file.tuff> --lint --lint-strict -o <out.js>

# Web bundles
bun run build:web              # IIFE global bundle
bun run build:web:esm          # ESM module bundle
bun run web:verify             # Browser API sanity check
```

## Files to Read First for Most Changes

- **CLI/options surface**: `src/main/js/cli.ts`
- **Diagnostics model and formatting**: `src/main/js/errors.ts`
- **Parser + declaration modifiers** (`out`, `copy`, `extern`): `src/main/js/parser.ts`
- **Borrow semantics and copy-type rules**: `src/main/js/borrowcheck.ts`
- **Selfhost parity baseline**: `src/test/js/selfhost-parity.ts`
- **Production diagnostics contract**: `src/test/js/phase4-production.ts`

## High-Level Architecture

### Compiler Pipeline (Stage 0)

The canonical pipeline lives in `src/main/js/compiler.ts`:

```
Source text
  → lex         (lexer.ts)        — tokenize with source positions
  → parse        (parser.ts)       — recursive descent → CST
  → desugar      (desugar.ts)      — CST → Core AST; expands `class fn`, etc.
  → resolve      (resolve.ts)      — symbol table, shadowing check, expect/actual pairing
  → typecheck    (typecheck.ts)    — bidirectional types, safety proofs (div/overflow/bounds)
  → borrowcheck  (borrowcheck.ts)  — ownership, move semantics, use-after-move
  → lint         (optional)        — style / maintainability checks
  → codegen      (codegen-js.ts or codegen-c.ts)
```

`compileSourceResult` / `compileFileResult` are the non-throw APIs used by all tests. The `*Throw` variants are legacy compatibility wrappers only.

### Two-Path Architecture

Stage 0 (TypeScript) and the selfhost (Tuff) compiler must stay **behaviorally aligned**. When you change parser, typecheck, borrow, module, or lint semantics in Stage 0, mirror the change in the selfhost path. The `selfhost:parity` test enforces this.

### Module System

Modules use Java-style package paths (`com::meti::Module`) mapped to files (`com/meti/Module.tuff`) under a `--module-base` root. Target-aware package aliasing is handled in `compiler.ts`. Cycle detection emits `E_MODULE_CYCLE`; the lint-warn variant emits `E_LINT_CIRCULAR_IMPORT` intentionally.

### Error Handling Model

All compiler internals use `Result<T, E>` from `src/main/js/result.ts` — no exceptions. Every diagnostic must satisfy the 4-part contract: `source | cause | reason | fix`. Diagnostic codes are stable identifiers (e.g., `E_SAFETY_DIV_BY_ZERO`, `E_RESOLVE_SHADOWING`) that tests assert directly.

### Selfhost Bootstrap

1. Stage 0 compiles `src/main/tuff/compiler.tuff` to JavaScript
2. That JavaScript runs in a VM sandbox with host builtins from `src/main/js/runtime.ts`
3. The compiled output is cached as `src/main/tuff/selfhost.generated.js`
4. `stage1:bootstrap` verifies triple-compilation equivalence (Stage 0 → Stage 1 → Stage 1)

### Browser Embedding

`src/main/js/web-compiler.ts` exposes the compiler as a browser bundle. It must not import Node-only modules. Bundles are built with `build:web` and `build:web:esm`.

## Critical Conventions

- **No new `throw`**: Use `Result<T, E>` (`ok`/`err`) in compiler internals. `lint:throws` will fail CI if throws are introduced.
- **Stable diagnostic codes**: Tests assert specific codes and all 4 contract fields (`source`, `cause`, `reason`, `fix`). Never rename or restructure a diagnostic without updating every affected test.
- **Keep pass boundaries explicit**: Avoid cross-pass refactors unless necessary. Pass inputs/outputs are distinct AST node types.
- **ESM imports use explicit `.ts` extensions** in all Stage 0 source files.
- **Shadowing is forbidden** by the resolver (`E_RESOLVE_SHADOWING`).
- **Borrow semantics**: move-by-default for structs; primitives are copy; enums are copy-by-default; `copy struct` and validated `copy type` aliases are explicitly copy-capable.
- **Strict safety is opt-in** via `--stage2` / `typecheck.strictSafety`; tests that assert safety errors must enable it.
- **Lint modes**: warn mode keeps compilation successful with `lintIssues`; `--lint-strict` / error mode fails on first issue.
- **When changing CLI flags, diagnostics, borrow, lint, or module semantics**: update the matching test files in `src/test/js/` in the same change.

## Adding Tests

1. Add a `.tuff` program under `src/test/tuff/cases/`
2. Add a `.result.json` with the expected runtime output value
3. Run `bun run test:update` to generate the snapshot; `run-tests.ts` auto-discovers new cases

## Known Gaps

See `GAPS.md` for current implementation gaps vs the language specification. Key open items:
- Some diagnostic codes differ between Stage 0 and selfhost (e.g., selfhost collapses some errors to `E_SELFHOST_PANIC`)
- `async fn` / CPS desugaring not yet implemented
- Dependent array length signatures (`L : USize`) not fully implemented
