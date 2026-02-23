# JS Harness

This folder is the thin TypeScript harness around the self-hosted compiler.
There is no Stage 0 compiler here — all compilation is performed by
`src/main/tuff/selfhost.tuff` (loaded as `selfhost.generated.js`).

- `cli.ts` — CLI entry point; parses flags, calls compiler, formats diagnostics
- `compiler.ts` — Loads `selfhost.generated.js` into a VM context and delegates
- `runtime.ts` — JS implementations of Tuff runtime intrinsics (`panic_with_code`, `panic_with_code_loc`, collections, etc.)
- `errors.ts` — `TuffError`, `formatDiagnostic`, `enrichError`
- `result.ts` — `Result<T, E>` helpers (no `throw` policy)
- `c-runtime-support.ts` — Embedded C substrate loader

CLI usage:

```
npx tsx src/main/js/cli.ts <input.tuff> -o <output.js>
npx tsx src/main/js/cli.ts <input.tuff> --modules --module-base ./src/main -o <output.js>
```
