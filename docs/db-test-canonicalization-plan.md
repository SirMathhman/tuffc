# DB Test Canonicalization Plan (Phased Execution)

This document tracks the execution of migrating hardcoded tests in `src/test/js` into
`scripts/test_cases.db`, making the DB the source of truth.

## Canonical Decisions

- Canonical DB path: `Tuffc/scripts/test_cases.db`
- Diagnostic matching: **exact single code** (no alias set matching)
- Multi-file tests: **embedded in DB** (`path + content` rows)
- Snapshot expectations: **stored in DB expectations**
- Deterministic order: `category ASC, case id ASC`

## Migration Inventory

### Phase-3 migration targets

1. `src/test/js/spec-semantics-exhaustive.ts`
   - Positive cases: compile success assertions
   - Negative cases: compile failure assertions with diagnostic code checks
2. `src/test/js/demo-regressions.ts`
   - Compile-fail and compile-success fixtures from `tests/*.tuff`
3. `src/test/js/tuff-native-compiler.ts`
   - Out-of-scope for DB JS-core migration (native C compilation integration)
   - Deferred: can be represented later through `execution_mode = native-c`

### Initial excluded suites

- `selfhost-parity.ts`
- `selfhost-stress.ts`
- `phase3-stage2.ts`
- `phase4-production.ts`

These suites include cross-stage parity and stress semantics that need additional DB
expressiveness beyond the first rollout.

## DB Canonicality Checks

- Test runner must reject duplicate legacy DB files when both exist:
  - `Tuffc/test_cases.db`
  - `Tuffc/scripts/test_cases.db`
- CI orchestration must invoke DB runner for migrated suites and remove duplicate hardcoded execution.
