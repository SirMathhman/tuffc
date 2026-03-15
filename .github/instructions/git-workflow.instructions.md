---
name: git-workflow
description: "Use when: managing file operations, refactoring code structure, reorganizing project files. Enforce consistent git workflow practices for preserving history and tracking changes."
applyTo: "**"
---

# Git Workflow Instructions

## File Movement

**Always use `git mv` when moving or renaming files.**

This preserves file history in Git, allowing blame and log to track changes across renames. Do not use shell commands like `mv` or PowerShell `Move-Item` as they break Git's history tracking.

### Examples

✅ **Correct:**

```bash
git mv src/old-path/file.ts src/new-path/file.ts
git commit -m "Move file.ts to new-path"
```

❌ **Incorrect:**

```bash
mv src/old-path/file.ts src/new-path/file.ts  # breaks history
git add src/new-path/file.ts
git rm src/old-path/file.ts
git commit -m "Move file.ts to new-path"
```

## Deletion

**Always use `git rm` when deleting files.**

This stages the deletion in Git and preserves the fact that the file was removed (not just left in limbo). Do not use shell commands like `rm` or PowerShell `Remove-Item` followed by `git add`, as these are error-prone and less explicit about intent.

### Examples

✅ **Correct:**

```bash
git rm src/old-file.ts
git commit -m "Remove old-file.ts"
```

❌ **Incorrect:**

```bash
rm src/old-file.ts  # leaves git confused
git add src/
git commit -m "Remove old-file.ts"
```

## Summary

- **Move files**: `git mv <old> <new>`
- **Delete files**: `git rm <file>`
- **Commit all changes**: Always review with `git status` before committing
