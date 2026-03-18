---
description: "Use when coverage is below threshold because of consistently unreachable statements. Prefer removing dead code over keeping untestable branches."
applyTo: "src/**/*.ts"
---

# Coverage and dead-code policy

- If a statement is consistently uncovered and cannot be reached through valid program inputs, treat it as dead or unreachable code.
- Prefer removing or refactoring unreachable statements rather than lowering coverage thresholds.
- Do not keep branches only for hypothetical states that cannot occur with current type and parser invariants.
- Keep behavior-focused defensive checks that are reachable from malformed user input.
- After removing unreachable code, update tests to cover the new control flow and rerun `npm run test`.
