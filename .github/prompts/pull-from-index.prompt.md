---
name: pull-from-index
description: Implement a new test case based on index.tuff content
---

Create a test case to verify the current index.tuff behavior. The user may the expected output (a number or error). If the user does not provide an expected output, assume the test should pass without errors and produces 0.

To avoid duplication, extract a minimal test case that replicates the scenario instead of copying the entire index.tuff file.

Add the test to the test suite following project conventions, then verify it passes by running `bun run test`.

**Important**: If `bun run start` fails while tests pass, the issue needs isolation. Continue adding tests to narrow down the specific problem, then fix that exact issue.

DO NOT EDIT index.tuff.