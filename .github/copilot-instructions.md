# Copilot Instructions for Tuff

## Project scope and architecture

- This repo is a Stage 0 JavaScript bootstrap compiler for Tuff-lite, plus a self-hosted Tuff compiler path.
- Main compiler pipeline lives in `src/main/js/compiler.ts`: `lex -> parse -> desugar -> resolve -> typecheck -> lint -> codegen`.
- Keep pass boundaries explicit; avoid folding pass logic together.
- Module-graph compilation (`enableModules`) is implemented in `compiler.ts` and uses `let { ... } = module` imports.
- Browser embedding uses `src/main/js/web-compiler.ts` (source string -> JS string) and intentionally avoids Node `fs/path` module loading.

## Core files to read before changing behavior

- CLI and user-facing options: `src/main/js/cli.ts`
- Error model and formatting contract: `src/main/js/errors.ts`
- Lint and auto-fix rules: `src/main/js/linter.ts`
- Selfhost parity expectations: `src/test/js/selfhost-parity.ts`
- Production diagnostics expectations: `src/test/js/phase4-production.ts`

## Result/error handling conventions

- Prefer `Result<T, E>` (`ok/err`) over exceptions in compiler internals (`src/main/js/result.ts`).
- Legacy throw wrappers exist for compatibility (`compileSourceThrow`, `compileFileThrow`); avoid adding new throw-based control flow.
- If emitting diagnostics, preserve the 4-part contract used by tests: `source`, `cause`, `reason`, `fix` (see `toDiagnostic` / `formatDiagnostic`).

## Project-specific behavior that tests depend on

- Name shadowing is a compile error (`E_RESOLVE_SHADOWING`) in resolver rules.
- Strict safety checks are opt-in (`--stage2` / `typecheck.strictSafety`).
- Lint has mode semantics: warnings are returned in `lintIssues`; in strict/error mode, first lint issue fails compilation.
- Circular module imports are currently surfaced as lint warning code `E_LINT_CIRCULAR_IMPORT` only when lint warn mode is active; otherwise they remain `E_MODULE_CYCLE` compile errors.

## Build/test workflows

- Full regression run: `npm test`
- Phase-specific checks: `npm run stage1:bootstrap`, `npm run stage2:verify`, `npm run stage4:verify`
- Selfhost checks: `npm run selfhost:modules`, `npm run selfhost:diagnostics`, `npm run selfhost:parity`
- Browser API check: `npm run web:verify`
- Build website bundles: `npm run build:web` (IIFE global `window.TuffCompiler`), `npm run build:web:esm`

## Coding patterns in this repo

- Keep `.ts` extension in local ESM imports (for example `import { lex } from "./lexer.ts"`).
- Maintain stable error codes when changing diagnostics (tests assert specific codes).
- Add or update targeted tests in `src/test/js/*` when changing pass semantics, lint rules, CLI flags, or diagnostics.
- Prefer minimal, phase-local changes; avoid broad refactors across compiler passes unless required.
