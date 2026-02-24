# Copilot Instructions for Tuff

## Big picture

- This repo has two compiler paths: Stage0 TypeScript (`src/main/js/*`) and selfhost Tuff (`src/main/tuff/selfhost*`). Keep them behaviorally aligned.
- Canonical pass pipeline in `src/main/js/compiler.ts`: `lex -> parse -> desugar -> resolve -> typecheck -> borrowcheck -> lint -> codegen`.
- `compileSourceResult` / `compileFileResult` are the non-throw APIs used by tests; throw wrappers are legacy compatibility only.
- Module graph mode (`enableModules`) is part of `compiler.ts` and uses `let { symbol } = module::path` imports.

## Files to read first for most changes

- CLI/options surface: `src/main/js/cli.ts`
- Diagnostics model/formatting: `src/main/js/errors.ts`
- Parser + declaration modifiers (`out`, `copy`, `extern`): `src/main/js/parser.ts`
- Borrow semantics and copy-type rules: `src/main/js/borrowcheck.ts`
- Selfhost parity baseline: `src/test/js/selfhost-parity.ts`
- Production diagnostics contract: `src/test/js/phase4-production.ts`
- Result<T,E> error model: `src/main/js/result.ts`

## Critical project conventions

### Error Handling (Zero-Throw Policy)

- ALL compiler code uses `Result<T, E>` (`ok/err`) from `src/main/js/result.ts`; **never throw exceptions**.
- `npm run lint:throws` enforces this in CI—new throws will fail the build.
- Use `flatMap`, `mapError`, `unwrapOr` combinators for error propagation.
- Why: Enables Tuff-in-Tuff portability, explicit control flow, testable error paths.

### Diagnostic Contract (4-Part Structure)

- Every `TuffError` MUST have: `code`, `source`, `cause`, `reason`, `fix`.
- Tests assert both diagnostic codes AND all 4 fields (`diagnostic-contract-utils.ts`).
- Stable codes (e.g., `E_SAFETY_DIV_BY_ZERO`, `E_RESOLVE_SHADOWING`) are part of the API contract.
- Never rename diagnostic codes without updating all affected tests.

### Pass Boundaries

- Each pass has strict input/output types (tokens → CST → Core AST → modified Core).
- Passes stop on first error (no error accumulation across passes).
- Cross-pass refactors should be avoided unless semantically necessary.
- Keep local ESM imports with explicit `.ts` extensions.

### Stage0 ↔ Selfhost Alignment

- When changing parser, typecheck, borrow, module, or lint semantics in Stage0, mirror the change in selfhost.
- `npm run selfhost:parity` enforces behavioral equivalence.
- Selfhost is preferred by default for JS target; Stage0 is used for C backend and bootstrap.

## Language semantics that tests depend on

### Shadowing is Forbidden

- Resolver always emits `E_RESOLVE_SHADOWING` for variable redeclaration.
- Why: Safety proofs require unambiguous variable identity for borrow tracking and refinement types.

### Strict Safety is Always On

- All safety checks (div-by-zero proofs, overflow, array bounds, match exhaustiveness) run unconditionally.
- The `strictSafety` option and `--stage2` CLI flag have been removed. Do not pass them.
- Strict mode enforces: div-by-zero proofs, overflow checks, array bounds, match exhaustiveness.

### Borrow Checker: Move-by-Default with Copy Escape Hatches

- **Primitives** (I32, Bool, etc.) are always copy.
- **Enums** are copy-by-default (no annotation needed).
- **Structs** are move-by-default; must mark `copy struct X { ... }` to enable copy.
- **Type aliases** (`copy type Alias = T`) are only copy if base type `T` is copyable.
- Use-after-move errors are `E_BORROW_USE_AFTER_MOVE`.

### Lint Modes

- **warn mode** (`--lint`): Compilation succeeds; issues collected in `lintIssues` array.
- **error mode** (`--lint-strict`): First lint issue causes compile failure (like type errors).
- Module cycles in warn mode emit `E_LINT_CIRCULAR_IMPORT`; strict mode emits `E_MODULE_CYCLE`.

### Module System

- Java-style package paths: `com::org::Module` → `com/org/Module.tuff`.
- Package aliases are target-aware (resolved in `compiler.ts`).
- Cycles are hard errors unless lint-warn mode is enabled.

## Testing conventions

### Test Case Structure

- Runtime tests: `src/test/tuff/cases/*.tuff` + matching `*.result.json` files.
- Test discovery: `run-tests.ts` auto-finds all `.tuff` files, compiles them, runs `main()`, compares JSON output.
- To add a test: create `foo.tuff`, add expected output to `foo.result.json`, run `npm run test:update` to snapshot.

### Verification Scripts

- **`stage1:bootstrap`**: Triple-compilation equivalence (Stage0 → Stage1 → Stage1 must match).
- **`stage2:verify`**: Safety proofs (div-by-zero, overflow, bounds checks, match exhaustiveness) — always active.
- **`stage4:verify`**: Diagnostic code stability and 4-part contract validation.
- **`borrow:verify`**: Ownership tracking, use-after-move, copy semantics.
- **`selfhost:parity`**: Stage0 and selfhost must produce identical runtime output for same input.

### Test Utilities

- Use helpers from `compile-test-utils.ts`: `expectCompileOk`, `expectCompileFailCode`, `expectCompileFailMessage`.
- Use `assertDiagnosticContract` (from `diagnostic-contract-utils.ts`) when testing error paths.

## Workflows (authoritative scripts from `package.json`)

- Full regression: `npm test`
- Targeted checks: `npm run stage2:verify`, `npm run stage4:verify`, `npm run borrow:verify`
- Selfhost checks: `npm run selfhost:modules`, `npm run selfhost:diagnostics`, `npm run selfhost:parity`
- **C backend**: `npm run c:verify:full` (smoke + e2e + alias checks); `npm run c:native:verify` (requires clang/gcc)
- Lint/type tooling: `npm run lint:eslint`, `npm run lint:throws`, `npm run typecheck`
- Browser bundle/API: `npm run build:web`, `npm run build:web:esm`, `npm run web:verify`

## C Backend

The Stage0 compiler has a second codegen target: `target: "c"` (in addition to the default JS target).

### C substrate layout

- **`src/main/c/`** — low-level C runtime: 6 headers + 6 implementations assembled in dependency order:
  - `substrate.h/.c` — ABI types (TuffValue, Vec, Map, Set, StringBuilder), tagged-value encoding, managed string registry, `tuff_panic`
  - `strings.h/.c` — string operations (`str_length`, `str_concat`, `str_eq`, etc.)
  - `string-builder.h/.c` — `sb_new`, `sb_append`, `sb_build`
  - `collections.h/.c` — Vec/Map/Set operations (`__vec_new`, `vec_push`, `map_set`, `set_add`, etc.)
  - `io.h/.c` — `read_file`, `write_file`, `path_join`, `path_dirname`, `print`, `print_error`
  - `panic.h/.c` — `panic`, `panic_with_code`
- Assembly is concatenated in that order (headers first, then implementations) by `src/main/js/c-runtime-support.ts`. All 12 files form **one translation unit**.
- **`src/main/tuff-c/`** — capability modules (`.tuff` files only): `Collections.tuff`, `IO.tuff`, `Panic.tuff`, `StringBuilder.tuff`, `Strings.tuff`, `stdlib.tuff`, `Console.tuff`. Each exposes C functions to Tuff via `extern fn` + `out expect fn` / `out actual fn` flat pattern.

### `extern let` attribution rules

Every `extern fn` declaration in a `.tuff` file MUST be preceded by an `extern let { ... } = module;` statement attributing the source module. The module name must match the actual C file name (without extension), using underscores instead of hyphens:

```tuff
extern let { sb_new, sb_append, sb_append_char, sb_build } = string_builder;
extern fn sb_new() : StringBuilder;
```

- `= collections`, `= io`, `= panic`, `= string_builder`, `= strings` for tuff-c functions
- `= string` (C stdlib `<string.h>`) for `strlen` etc.
- `= stdlib` for libc functions like `printf`
- Codegen validates attribution at compile time — missing attribution is a hard error.

### C verification scripts

- **`npm run c:verify`** — C backend smoke tests + monomorphization plan checks
- **`npm run c:native:verify`** — end-to-end: compile `.tuff` → `.c` → native binary via clang/gcc, run it, compare output (skips if no C compiler found)
- **`npm run c:verify:full`** — full C suite: `c:verify` + `expect:actual:verify` + `runtime:aliases` + `c:native:verify`
- **`npm run expect:actual:verify`** — validates `out expect fn` / `out actual fn` alias resolution in tuff-c modules
- **`npm run runtime:aliases`** — validates runtime package default alias resolution

### Key files for C backend changes

- Code generation: `src/main/js/codegen-c.ts`
- C runtime loader: `src/main/js/c-runtime-support.ts`
- Capability modules: `src/main/tuff-c/*.tuff`
- C source files: `src/main/c/*.h` + `src/main/c/*.c`

## Integration points

- **Browser embedding**: `src/main/js/web-compiler.ts` must avoid Node-only modules (`fs`, `path`, `vm`).
- **Runtime/extern integration**: Centralized in `src/main/js/runtime.ts`; mirrored in selfhost runtime declarations.
- **Selfhost bootstrap**: Lazy-cached on first use; runs Stage0-compiled selfhost in VM sandbox with host builtins.
- **When changing semantics**: Update matching tests in `src/test/js/*` in the same commit.
