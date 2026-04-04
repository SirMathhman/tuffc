# Spec 2: Multi-block extern import, extern fn declaration, let-fn-call, import.meta.url

## Problem

Four new constructs fail compilation:

1. Multiple extern import lines in one blank-line-separated block
2. `extern fn name(params);` standalone block
3. `let x = fn(arg);` let-binding via function call
4. `import.meta.url` as a function call argument

## Features

### 1. Multi-line extern import block

Consecutive extern import lines (no blank line) form one block. Each line compiles independently.

```
let { extern a } = extern node::fs;
let { extern b } = extern node::module;
```

→ `const { a } = __tuff_require("node:fs"); const { b } = __tuff_require("node:module");`

### 2. `extern fn` declaration

Compiles to nothing. Reserved for future type system.

```
extern fn createRequire(arg);
```

→ (no output)

### 3. `let x = fn(arg);`

Binds a function call result to a variable.

```
let x = createRequire(import.meta.url);
```

→ `const x = createRequire(__tuff_import_meta_url);`

### 4. `import.meta.url` built-in

The special literal `import.meta.url` compiles to `__tuff_import_meta_url`,
injected as a parameter in `new Function` with value `import.meta.url`.
In the bundle IIFE, it is supplied from the ESM module scope.

## Scope

- `extern fn` params: comma-separated valid identifiers or empty; all ignored at compile time.
- `let x = fn(arg);` arg: a valid identifier OR `import.meta.url`.
- Invalid identifier in extern fn declaration → compile error.
- Invalid arg in let-fn-call → compile error.
