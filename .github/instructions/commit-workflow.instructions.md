---
name: commit-workflow
description: "Use when: completing tasks, creating changes, finishing work. Enforce disciplined git workflow with automatic quality checks via pre-commit hooks."
applyTo: "**"
---

# Commit Workflow Instructions

## End-of-Task Commits

**Always commit your changes at the end of each task.**

Every completed piece of work — whether implementing a feature, fixing a bug, refactoring code, or changing configuration — must be committed to preserve history and track progress. Do not leave uncommitted changes when finishing work.

### When to Commit
- After implementing a feature or fix
- After migrating or reorganizing code
- After adding tests or documentation
- After updating configuration

### Example
```bash
# After finishing task
npm test
npm run cpd
npm run lint
git add .
git commit -m "Implement feature X"
```

## Respect the Pre-Commit Hook

**Never bypass the pre-commit hook with `--no-verify`.**

The pre-commit hook enforces a three-stage quality check:
1. **Tests** (`npm test`) — Run all unit tests
2. **Duplicates** (`npm run cpd`) — Detect copy-paste violations with 35-token threshold
3. **Lint** (`npx lint-staged`) — ESLint on staged files with auto-fix

If the hook fails, it means your changes violate quality standards and **should not be committed**. Fix the issues instead.

### Bypass is Prohibited
❌ **Never do this:**
```bash
git commit --no-verify -m "message"  # BLOCKS quality checks
```

✅ **Do this instead:**
```bash
# Fix and retry
npm test           # Fix failing tests
npm run cpd        # Refactor duplicated code
npm run lint       # Fix linting issues
git add .
git commit -m "message"  # Will pass all checks
```

## Summary

- **Complete commits**: End every task with a commit
- **Respect quality checks**: Let pre-commit run all 3 stages (tests → cpd → lint)
- **No bypasses**: Never use `--no-verify` — it defeats the purpose of automated checks
- **Trust the process**: If a check fails, it's catching a real issue
