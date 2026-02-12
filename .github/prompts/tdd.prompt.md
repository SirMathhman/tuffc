---
name: tdd
description: Test-Driven Development workflow for implementing new test cases
---

# TDD Workflow

1. **Receive test case** — User provides a test case to implement
2. **Add to test suite** — Add the test case to `tests/test.c` without reading source code
3. **Run tests** — Execute the test suite to observe the failure
4. **Implement feature** — Read and modify source code in `src/` to make the test pass. Do not hardcode the test case.
5. **Commit safely** — Commit changes; do not bypass pre-commit hooks with `--no-verify` (they ensure code quality)
