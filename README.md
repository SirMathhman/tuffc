# Tuff Stage 0 Bootstrap Compiler (JavaScript)

Implements Phase 1 / Stage 0 from `SELF-HOST.md`:

- Lexer with source positions
- Recursive-descent parser for Tuff-lite
- Desugaring pass (`class fn` support)
- Name resolution with no-shadowing checks
- Basic bidirectional-ish type checking for Tuff-lite
- JavaScript code generation
- CLI: `tuff compile file.tuff`
- Snapshot and runtime test harness

## Quick start

1. Run tests: `npm test`
2. Compile file: `node ./src/cli.js compile ./tests/cases/factorial.tuff -o ./tests/out/factorial.js`
