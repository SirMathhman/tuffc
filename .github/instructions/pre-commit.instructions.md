---
name: pre-commit-enforcement
description: "Enforce pre-commit checks in Tuffc project. Always commit with full validation—never use --no-verify."
applyTo: "**/*"
---

# Pre-Commit Check Enforcement

This project uses Husky pre-commit hooks to ensure code quality. All commits must pass the full validation suite.

## Rules

1. **Never skip pre-commit checks.** Do not use `--no-verify` under any circumstances.
2. **Always commit after changes.** At the end of any task that modifies files, commit the changes with a clear message.
3. **Verify all checks pass.** Before committing, ensure:
   - Tests pass: `bun test`
   - Linting passes: `bun run lint`
   - Code duplication is below threshold: `pmd cpd index.ts --language typescript --minimum-tokens 35`
   - Custom validation script passes: `bun scripts\single-use.ts`

## Pre-Commit Hook Behavior

The `.husky/pre-commit` hook runs all of the following in sequence:

1. **`bun test --timeout 5000 --concurrent`** — All tests must pass
2. **`bun run lint`** — ESLint must report no errors
3. **`bun scripts\single-use.ts`** — Custom validation script must complete successfully
4. **`pmd cpd index.ts --language typescript --minimum-tokens 35`** — Code duplication check (must not exceed minimum-tokens threshold)

If any check fails, the commit is rejected and you must fix the issues before trying again.

## Workflow

1. Make code changes
2. Run all validation checks locally to verify:
   - `bun test`
   - `bun run lint`
   - `bun scripts\single-use.ts`
   - `pmd cpd index.ts --language typescript --minimum-tokens 35`
3. Commit with `git commit -m "message"` — the hook will validate all checks
4. If validation fails, read the error output, fix the issues, and retry the commit
5. Never force-push or use `--no-verify` to bypass checks

## Common Issues and Solutions

### Tests Fail

1. Read the test output carefully to identify failing assertions
2. Fix the code to pass the tests
3. Run `bun test` again to confirm
4. Retry `git commit`

### Linting Fails

1. Run `bun run lint` to see all ESLint errors
2. Fix code style and quality issues
3. Run `bun run lint` again to confirm
4. Retry `git commit`

### Custom Script Fails

1. Run `bun scripts\single-use.ts` to see the error output
2. Address the issues reported by the script
3. Retry `git commit`

### Code Duplication Detected

1. Run `pmd cpd index.ts --language typescript --minimum-tokens 35` to see violations
2. Refactor duplicated code into reusable functions or utilities
3. Retry `git commit`
