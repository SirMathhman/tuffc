# tuffc

`tuffc` compiles Tuff source to JavaScript.

## Single-file compilation

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run
```

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Multi-file compilation

The compiler also exposes `compileProject(...)` for entry-driven project builds.

- Every `.tuff` file is treated as an implicit singleton module object.
- Plain `.js` files can act as companion foreign providers for extern-backed modules.
- Module names are inferred from file paths, so `com/example/Main.tuff` becomes `com::example::Main`.
- Use `::` only for module qualification.
- Use `.` for member access on the resolved module object.

### Example

- `Math.tuff` can export `fn max(...)` and be consumed as `Math.max(3, 4)`.
- `com/example/Math.tuff` can be consumed as `com::example::Math.max(3, 4)`.
- Module destructuring works through the module object too: `let { max } = Math; max(3, 4)`.

### Extern-backed modules

Tuff modules can declare contracts that are implemented by companion JavaScript files.

- Use `extern ModuleName;` at the top level of the module contract file to mark the module as externally backed.
- Declare foreign members with top-level contracts such as `extern fn`, `extern let`, and `extern type`.
- Provide a companion `.js` file with the same inferred module name, for example `Math.tuff` + `Math.js`.
- The companion `.js` file is loaded as a CommonJS-style provider (`module.exports` / `exports`).

Example contract file:

- `Math.tuff`: `extern Math; extern fn max(a : I32, b : I32) : I32; extern let answer : I32;`
- `Math.js`: `module.exports = { max: (a, b) => (a > b ? a : b), answer: 42 };`

Consumers still use the normal module surface:

- `Math.max(3, 4)`
- `let { max } = Math; max(3, 4)`
- `Math.answer`

At runtime, extern-backed modules validate that required exports exist, and `extern fn` members additionally validate that the JS export is callable.

### API shape

`compile(input: string)` keeps the existing single-file behavior.

`compileProject({ entryModule, files, target? })` accepts:

- `entryModule`: the fully qualified module name to execute
- `files`: a path-to-source map, using either `/` or `\` path separators
- `target`: currently optional and defaults to `"js"`

Only modules reachable from the entry module are compiled, and the entry module's final top-level expression becomes the program result.

For extern-backed modules, the `files` map can include both `.tuff` contract files and companion `.js` provider files.

## Forward direction

The current foreign-file pipeline is intentionally target-aware even though only the `js` target is implemented today.

- `extern` means “implemented outside Tuff,” not “implemented in JavaScript forever.”
- The internal project model now tracks module implementation origin and target metadata.
- This keeps the compiler open to future source-set evolution such as shared/common code plus target-specific providers (for example `js` now and `c` later).
