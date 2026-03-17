---
description: "Use when writing tests, increasing coverage, or handling uncovered branches. Prefer removing unreachable/dead code over forcing artificial tests for non-executable paths."
---

# Coverage and Dead Code Guidance

- Treat persistent un-coverable lines as a dead-code signal first, not a test-writing challenge.
- Before adding workaround tests, verify whether the uncovered branch is reachable in real runtime behavior.
- If code is unreachable or redundant, remove or simplify it (hard rule).
- Keep behavior-preserving refactors small and test-backed.
- Prefer meaningful tests for real behavior over coverage-only tests for impossible states.
- If uncertain whether a path is dead or simply hard to reach, document the reasoning and ask for confirmation.
