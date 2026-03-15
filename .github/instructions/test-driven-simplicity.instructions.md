---
name: test-driven-simplicity
description: "Use when: managing test coverage, refactoring code, or debating whether to keep a feature. If tests pass without a line of code, delete it—don't over-engineer solutions."
applyTo: "**/*.ts"
---

# Test-Driven Simplicity

## Core Principle

**Code that tests don't require is over-engineered and should be deleted.**

When you have passing tests and uncovered lines, the solution is not to add more tests or contort code to cover edge cases. The solution is to delete the unnecessary code.

This principle has two parts:

1. **Coverage-Driven Deletion**: If a line isn't executed by any test, it either isn't needed or the test suite is incomplete. Start with deletion; add tests only if the code serves a genuine purpose.

2. **Simplicity-First Design**: Prefer minimal, working code that passes all tests over elegant abstractions, defensive checks, or "future-proofing."

## When to Apply

- **During refactoring**: After tests pass, review the code. Does every line have a test that exercises it? If not, delete it.
- **When coverage complaints appear**: You see warnings like "line 42 is uncovered" or "branch is untested." Don't add coverage—delete the line.
- **When debating features**: "Should we add this guard clause?" "Should we handle this edge case?" Answer: If a test doesn't require it, no.

## When NOT to Apply

- **Infrastructure or type safety**: Type definitions, imports, and framework scaffolding aren't "covered" in the traditional sense but are necessary.
- **Error handling for external inputs**: If the code handles user or API input, defensive checks serve a purpose even if current tests don't exercise all paths. Document why each check exists.
- **Performance-critical paths**: Optimizations aren't typically tested directly; this principle applies to feature code, not optimizations.

## Example

You have:

```typescript
function parseTypedNumber(input: string) {
  // ... parsing logic ...
  const value = parseInt(numericValue, 10);
  
  // Defensive check: in case parseInt fails
  if (isNaN(value)) {
    return new Err({ /* ... */ });
  }
  
  return new Ok({ value, type: "untyped" });
}
```

**Question**: Is the `isNaN` check covered by tests?

- **Yes**: Keep it. Tests exercise this code path.
- **No, and tests pass without it**: Delete it. If all test inputs produce valid numbers, this guard is not needed today.
- **No, but it's defensive for real-world input**: Document *why* it's there in a comment. Consider writing a test for it anyway.

## How This Project Uses It

In the Tuff compiler:

- All error paths must have tests that trigger them.
- All branches (arithmetic operations, type checks) must have corresponding test cases.
- Dead code paths get deleted, not commented.
- Jest coverage thresholds (currently 98%+) fail the build if this principle is violated—use it as a signal.

## Workflow

1. **Run tests**: `npm test` to check coverage.
2. **Review uncovered lines**: Look at the coverage report. Is the code necessary?
3. **Delete or test**:
   - If unnecessary → delete.
   - If necessary but uncovered → write a test that covers it.
4. **Never add dead code** to "be safe" or "handle future cases."

---

**Rationale**: Simple code is easier to maintain, understand, and reason about. Over-engineering creates technical debt. Let tests guide what stays.
