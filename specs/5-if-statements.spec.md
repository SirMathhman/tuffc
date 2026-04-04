# Spec 5: If Statements in Function Bodies

## Objective

Add `if` / `else if` / `else` statements to function bodies, enabling real control flow inside Tuff functions. This is the prerequisite for self-hosting `compileTuffToJS` in `main.tuff`, whose body is a chain of early-return `if` checks.

## Syntax

```
if_stmt ::= "if" " " "(" condition ")" " " "{" newline
              body_stmts
            "}" [ " else if (" condition ") {" body_stmts "}" ]*
                [ " else {" body_stmts "}" ]

condition ::= expr               (bare expression, truthy check)
            | expr comp_op expr  (comparison)
            | condition logic_op condition
            | "(" condition ")"

comp_op  ::= "==" | "!=" | "<" | ">" | "<=" | ">="
logic_op ::= "&&" | "||"

body_stmts ::= (let_stmt | return_stmt | if_stmt)*
```

### Notes

- Conditions use `==` and `!=` (not `===`/`!==`) — these map directly to JS `==` and `!=`.
- Any body expression is valid as a condition operand (identifiers, numbers, `undefined`, `import.meta.url`, `read()`, chained method calls, etc.)
- Condition syntax is identical to JS condition syntax for the supported operators; compilation is verbatim except for `read()` and `import.meta.url` special forms.
- `if` header must be written as `if (cond) {` on a single line.
- `} else if (cond) {` must appear on a single line.
- `} else {` must appear on a single line.
- Closing `}` must be on its own line.
- Nesting is arbitrary — any body statement (including `if`) is valid inside any `if`/`else` body.

## User Stories

- As a Tuff developer, I want `if (cond) { ... }` in function bodies so I can implement conditional return dispatch.
- As a Tuff developer, I want `else if` and `else` so I can handle multiple branches without nested functions.
- As a Tuff developer, I want to nest `if` statements arbitrarily so I can express complex logic.
- As a Tuff developer, I want any body statement inside an `if` body so nothing is artificially restricted.
- As a Tuff developer, I want `&&` and `||` in conditions so I can express compound guards.

## What This Feature Must NOT Do

- Must not change the semantics of `==` and `!=` (they compile verbatim, not to `===`/`!==`).
- Must not allow `!` (not operator) — not in scope.
- Must not allow `+`, `-`, `*`, `/` etc. in conditions — arithmetic is not valid in a condition operand in this iteration.
- Must not allow inline single-line `if` without braces.
- Must not allow `else` on a separate line from the closing `}`.

## Compilation Target

```tuff
if (x != undefined) {
    return x;
} else {
    return y;
}
```

Compiles to:

```js
if (x != undefined) {
  return x;
} else {
  return y;
}
```

## Relation to Prior Specs

Revises spec 4 (recursive-body-expressions) to add `if_stmt` as a valid body statement kind.
