# Workspace instructions for `tuffc`

## Project snapshot

`tuffc` is a small TypeScript/CommonJS project that parses and evaluates Tuff numeric literals and simple arithmetic.

## How to work in this repo

- Prefer small, targeted changes.
- Read the relevant source and test files before editing.
- Keep the implementation consistent with the existing parser/evaluator style in `src/index.ts`.
- When changing behavior, update tests in `tests/index.test.ts` alongside the code.

## Build, test, and lint

- Build: `npm run build`
- Test: `npm run test`
  - Jest runs with coverage enabled.
  - Coverage thresholds are enforced at 100% for statements, branches, functions, and lines.
- Lint: `npm run lint`

## Codebase conventions

- Use TypeScript interfaces for object shapes.
- Avoid `Record`; prefer `Map` when a lookup table is needed.
- Avoid regexes; use manual parsing/scanning instead.
- Avoid `throw`; use the existing `Result<T, E>` pattern in `src/index.ts`.
- Keep `interpretTuff` returning `Result<number, TuffError>` and preserve the richer error payload:
  - `sourceCode`
  - `message`
  - `reason`
  - `suggestedFix`

## Key files

- `src/index.ts` — Tuff parser/evaluator and error model
- `tests/index.test.ts` — behavior and error-shape coverage
- `jest.config.cjs` — Jest + coverage settings
- `eslint.config.mjs` — lint guardrails
- `package.json` — scripts and dependencies

## Pitfalls to avoid

- Do not reintroduce hooks-based workflows; the repo uses npm scripts instead.
- Do not duplicate the commit workflow guidance here; see `.github/instructions/commit-workflow.instructions.md`.
- Be careful with coverage-driven test changes: `npm run test` fails if coverage is below 100%.
- Do not keep truly unreachable statements only to be defensive; remove/refactor dead code when it blocks coverage and cannot be hit by valid inputs.
- Keep parser changes in sync with the existing tests and error semantics.

## Useful references

- Commit workflow: `.github/instructions/commit-workflow.instructions.md`
- Coverage/dead-code policy: `.github/instructions/coverage-dead-code.instructions.md`
- Project overview: `README.md`
