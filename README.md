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
- Module names are inferred from file paths, so `com/example/Main.tuff` becomes `com::example::Main`.
- Use `::` only for module qualification.
- Use `.` for member access on the resolved module object.

### Example

- `Math.tuff` can export `fn max(...)` and be consumed as `Math.max(3, 4)`.
- `com/example/Math.tuff` can be consumed as `com::example::Math.max(3, 4)`.
- Module destructuring works through the module object too: `let { max } = Math; max(3, 4)`.

### API shape

`compile(input: string)` keeps the existing single-file behavior.

`compileProject({ entryModule, files })` accepts:

- `entryModule`: the fully qualified module name to execute
- `files`: a path-to-source map, using either `/` or `\` path separators

Only modules reachable from the entry module are compiled, and the entry module's final top-level expression becomes the program result.
