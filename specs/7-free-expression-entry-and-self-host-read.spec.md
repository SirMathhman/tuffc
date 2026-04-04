# Spec 7: Free Expression Entry and Self-Host read()

## Objective

Two related changes:

1. **Free expression as program entry** — any valid body expression (identifier, literal, method chain, function call, `+` expression) can appear as the sole statement of a Tuff program. It compiles to `return <expr>;`. This is the minimal step needed to call `compileTuffToJS("read()")` as the entry point in a test program.

2. **Self-hosted read() case** — `main.tuff`'s `compileTuffToJS(source)` body is extended with the first real dispatch: when `trimmed == "read()"`, return the compiled JS string `"return __tuff_coerce(__tuff_read());"`.

## Change 1: Free Expression Entry

### Grammar (new)

A single-line Tuff program whose source is a valid body expression compiles to `return <compiled_expr>;`.

```
program ::= expr
          | ... (existing forms)
```

Where `expr` is the body expression grammar from spec 4 (identifiers, numbers, strings, method chains, function calls, `+`).

### Rules

- Only a *complete* expression qualifies — `pos` must consume all tokens.
- `read()` is already dispatched earlier and compiles to `return __tuff_coerce(__tuff_read());` — the fallback produces the same result and is never reached for that case.
- Comparison expressions (`x == y`, `x != y`) contain a two-character op token that `parseBodyExprNode` does not consume, so `compileBodyExpression` returns `undefined` for them — they are not matched.
- Free expressions are supported in single-line programs AND as the final block of multi-block programs.

### Compilation examples

```tuff
compileTuffToJS("read()")
```
→
```js
return compileTuffToJS("read()");
```

```tuff
f(read())
```
→
```js
return f(__tuff_coerce(__tuff_read()));
```

```tuff
"hello".trim()
```
→
```js
return "hello".trim();
```

### What this must NOT do

- Must not allow bare comparison expressions (`x == y`) as an entry (no result — they involve unsupported ops).
- Must not shadow any existing dispatch — the fallback fires only after all previous dispatchers return `undefined`.

## Change 2: main.tuff — read() dispatch

`main.tuff`'s `compileTuffToJS` body is extended:

```tuff
out fn compileTuffToJS(source) => {
    let trimmed = source.trim();
    if (trimmed == "read()") {
        return "return __tuff_coerce(__tuff_read());";
    }
}
```

This is tested by compiling the program:

```tuff
out fn compileTuffToJS(source) => {
    let trimmed = source.trim();
    if (trimmed == "read()") {
        return "return __tuff_coerce(__tuff_read());";
    }
}
compileTuffToJS("read()")
```

Expected: the program calls the locally-defined `compileTuffToJS` with the string `"read()"` and returns `"return __tuff_coerce(__tuff_read());"`.

## Relation to Prior Specs

- Extends spec 4 (recursive body expressions): adds free expressions as program entry.
- Extends spec 6 (string literals): the string `"read()"` is a valid argument/condition.
- Unlocks: the incremental build-out of `compileTuffToJS` in `main.tuff` — subsequent specs will add more dispatch cases.
