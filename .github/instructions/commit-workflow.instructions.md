---
description: "Use when preparing code changes for handoff. Always run the precommit script, create a git commit, and include the commit hash in the final response."
applyTo: "**"
---
# Commit workflow

- Before finalizing code changes, run `npm run precommit`.
- If checks pass, create a git commit for the changes.
- Treat the commit hash as a required deliverable and include it in the response.
- Do not rely on hooks for this workflow; use the npm script instead.