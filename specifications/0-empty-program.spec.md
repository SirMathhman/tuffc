# 0 — executeTuff Empty Program

## Objective

`executeTuff("")` must return `0`.

## Context

`executeTuff` is the top-level Tuff execution pipeline:

1. Compile Tuff source → TypeScript via `compileTuffToTS`
2. Validate the TypeScript with ESLint
3. Compile TypeScript → JavaScript via `ts.transpileModule`
4. Run the JavaScript with Bun and return its exit code

## User Stories

- As a Tuff runtime, I want `executeTuff("")` to return `0` so that an empty program is a valid no-op that exits cleanly.

## Behaviour Specification

### Empty program semantics

- An empty string is a valid Tuff program.
- `compileTuffToTS("")` returns `""` (empty TypeScript).
- An empty TypeScript file is valid — ESLint must pass on it.
- An empty JavaScript file run by Bun exits with code `0`.
- Therefore `executeTuff("")` must resolve to `0`.

### What this spec does NOT cover

- Non-empty Tuff programs (future specs).
- Error/invalid-source paths (future specs).
