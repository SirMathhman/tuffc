# Spec 1: Multiple Names in a Single Extern Import

## Problem

`let { extern readFileSync, extern writeFileSync } = extern node::fs;` fails
because the parser only handles exactly one `extern <name>` entry.

## Feature

Allow one or more `extern <name>` entries, comma-separated, in a single
extern import block:

```
let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;
```

Compiled output (single require, full destructuring):

```js
const { readFileSync, writeFileSync, mkdirSync } = __tuff_require("node:fs");
```

## Scope

- One or more names: minimum 1 still works (no regression).
- Potentially infinite names on the same line.
- Any invalid identifier in the list → compile error.
- Invalid module path → compile error.
