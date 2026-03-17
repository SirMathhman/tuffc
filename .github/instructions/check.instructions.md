---
description: "Use when completing any coding task. Always run check.ps1 at the end of every task and fix any failures before finishing."
applyTo: "**"
---

# Task Completion Check

After completing **any** coding task, always run the check script:

```
pwsh check.ps1
```

This script builds the tests and runs them. It **must pass** before the task is considered done. If it fails, fix the errors and run it again until it passes.
