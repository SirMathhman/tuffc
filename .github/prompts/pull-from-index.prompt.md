---
name: pull-from-index
description: Implement a new test case based on index.tuff content
---

## Strict Step-by-Step Workflow

1. **Understand the expected output**
   - Review what the user provided as the expected output (a number or error)
   - If no expected output is provided, assume the test should pass without errors and produce 0. Find the current error using `bun run start`.

2. **Extract a minimal test case**
   - Do NOT copy the entire index.tuff file
   - Create a minimal test case that replicates the scenario from index.tuff

3. **Add the test to the suite**
   - Add the test following project conventions
   - Do not modify index.tuff

4. **Verify the test passes**
   - Run `bun run test`
   - Confirm all tests pass

5. **If `bun run start` fails (only if tests pass)**
   - The issue requires isolation beyond the test
   - Continue adding targeted tests to narrow down the specific problem
   - Once identified, fix that exact issue only

**Critical Constraint**: DO NOT EDIT index.tuff under any circumstances.
