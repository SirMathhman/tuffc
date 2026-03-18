# Copilot instructions for `tuffc`

When completing any coding task in this repository:

- Always run the check script before finishing using:
  - `bun run check`
- If the output indicates actionable clone classes, perform a practical refactor in the same task.
- Prefer refactors that improve maintainability without changing behavior (e.g., extracting helpers, consolidating repeated setup, reducing repeated literals or object-shape boilerplate).
- After refactoring, re-run `bun run check` and ensure behavior remains unchanged and duplicates were removed before concluding.