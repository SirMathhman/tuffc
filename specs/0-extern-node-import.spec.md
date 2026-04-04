# Spec 0: Extern Node Import Statement

## Problem

The compiler is too inflexible. A standalone extern import line like
`let { extern readFileSync } = extern node::fs;` cannot appear as a block in
a multi-line Tuff program. Only `fn name() => { ... }` blocks are accepted as
non-final blocks.

## Feature

Allow `let { extern name } = extern path::segments;` as a standalone block
within a multi-line Tuff program (separated by blank lines). This block imports
a named function from a Node.js module and makes it available in subsequent
blocks within the same program.

### Module path convention

Tuff uses `::` as a path separator. For Node built-in modules, the `::` maps
to `:` when producing the `require()` specifier.
Example: `node::fs` → `require("node:fs")`

### Compiled output

`let { extern readFileSync } = extern node::fs;` compiles to:

```js
const { readFileSync } = require("node:fs");
```

### Multi-line integration

All compiled blocks are concatenated into a single function body, so
any imported name is in scope for the final expression block.

## Scope

- Import in multi-line programs only (blank-line separated blocks).
- Final block is a valid Tuff expression (`read()`, arithmetic, etc.).
- Invalid identifiers or module path segments → compilation error.
- Mixing extern imports with fn definitions in any order is supported.

## User stories

- As a Tuff developer, I want to write `let { extern f } = extern node::fs;` as a
  block so I can import Node built-ins.
- As a Tuff developer, I want to combine extern imports and fn definitions in one
  program.
- As a Tuff developer, I want invalid extern import syntax to throw at compile time.
