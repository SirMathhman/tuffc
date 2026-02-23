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

Stage0 is no longer used by default package entrypoints or build commands.

- Package bin entrypoints (`tuff`, `tuffc`) now route to native selfhost launcher.
- `build:binary` packages the native selfhost CLI artifact.

Residual Stage0 TypeScript sources remain in-repo only as historical/bootstrap implementation material until final archival/removal.
