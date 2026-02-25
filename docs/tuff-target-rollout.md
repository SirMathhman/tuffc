# Tuff Target Rollout Notes (Phase 7)

## Scope shipped

- New compile target: `--target tuff`
- Output extension support: `.tuff`
- Selfhost dispatch support in both single-file and module-file compilation paths
- Deterministic lint-fix safe subset (receiver-call rewrite)
- Core regression coverage for target emission + trivia + lint-fix interaction

## Safety model

- Emission path remains deterministic and newline-normalized.
- Lint-fix is conservative and rule-scoped.
- Compile diagnostics remain structured and informative.

## Known limitations

- v1 printer path preserves trivia via source-preserving strategy and currently does not perform full structural AST reprint for all node kinds.
- Lint-fix safe subset currently includes receiver-call rewrites only.
- Complex overlapping rewrites are intentionally skipped.

## Validation

Validated in this rollout via:

- `src/test/js/phase4-production.ts`
- `src/test/js/tuff-target.ts`
- `src/test/js/test-orchestrator.ts --suite=core`
