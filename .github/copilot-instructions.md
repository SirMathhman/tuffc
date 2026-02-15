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

## Critical project conventions

- Prefer `Result<T, E>` (`ok/err`) in compiler internals (`src/main/js/result.ts`); do not add new exception-based control flow.
- Preserve stable diagnostic codes and the 4-part contract (`source`, `cause`, `reason`, `fix`); tests assert both.
- Keep compiler pass boundaries explicit; avoid cross-pass refactors unless necessary.
- Keep local ESM imports with explicit `.ts` extensions.
- Stage0 and selfhost changes should be mirrored when semantics overlap (parser/typecheck/borrow/module behavior).

## Language semantics that tests depend on

- Resolver forbids shadowing (`E_RESOLVE_SHADOWING`).
- Strict safety is opt-in (`--stage2` / `typecheck.strictSafety`).
- Borrow is move-by-default; primitives are copy; enums are copy-by-default; `copy struct` and validated `copy type` aliases are copy-capable.
- Lint modes matter: warn mode keeps compilation successful with `lintIssues`; strict/error mode fails on first issue.
- Module cycles are `E_MODULE_CYCLE` unless lint-warn flow intentionally surfaces `E_LINT_CIRCULAR_IMPORT`.

## Workflows (authoritative scripts from `package.json`)

- Full regression: `npm test`
- Targeted checks: `npm run stage2:verify`, `npm run stage4:verify`, `npm run borrow:verify`
- Selfhost checks: `npm run selfhost:modules`, `npm run selfhost:diagnostics`, `npm run selfhost:parity`
- Lint/type tooling: `npm run lint:eslint`, `npm run lint:throws`, `npm run typecheck`
- Browser bundle/API: `npm run build:web`, `npm run build:web:esm`, `npm run web:verify`

## Integration points

- Browser embedding is through `src/main/js/web-compiler.ts` and must avoid Node-only module loading.
- Runtime/extern integration is centralized in `src/main/js/runtime.ts` and mirrored in selfhost runtime declarations.
- When changing CLI flags, diagnostics, borrow, lint, or module semantics, update matching tests in `src/test/js/*` in the same change.
