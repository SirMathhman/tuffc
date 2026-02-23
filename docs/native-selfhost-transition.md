# Native selfhost transition (single source of truth)

## Decision

- **Compiler source of truth**: `src/main/tuff/selfhost.tuff`
- **Default execution path**: generated native compiler (`stage3_selfhost_cli.exe` / `stage3_selfhost_cli`)
- **Stage0 TypeScript compiler**: temporary fallback/bootstrap mechanism only

## Default workflow

1. Build/refresh native selfhost artifacts:
   - `npm run native:selfhost:parity`
2. Use native compiler directly:
   - `npm run native:selfhost:run -- <args>`

Examples:

- Sample compile:
  - `npm run compile:sample`
- Lint sample:
  - `npm run lint`

## Stage0 status

Stage 0 TypeScript compiler code has been removed. `src/main/js/` now contains
only the JS harness (CLI, error types, runtime bindings). All compilation routes
through the self-hosted native compiler.

- Package bin entrypoints (`tuff`, `tuffc`) route to the native selfhost launcher.
- `build:binary` packages the native selfhost CLI artifact.
