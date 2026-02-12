---
name: test-case
description: Implement a test case provided by the user
---

## Workflow

1. Do not read any source code files at this stage.
2. Receive test case from user.
3. Add test case to the test file.
4. Run the test case with `bun test`.
5. If the test passes, commit the changes and end. Skip to step 10.
6. If the test fails, examine the error message carefully.
7. Read the relevant source code files to understand the implementation.
8. Implement the necessary changes to make the test pass.
9. Commit the changes. Do not use `--no-verify`. Respect pre-commit hooks strictly. If encountering difficulties, ask the user for guidance.
10. End.
