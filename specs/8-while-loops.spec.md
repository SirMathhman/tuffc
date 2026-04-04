# Spec 8: While Loops

## Objective

Add support for `while` statements in Tuff using this syntax:

`while (<condition>) { <body> }`

The condition uses JavaScript-style truthiness semantics at runtime. `while` should be supported in any statement block context that currently supports block statements (including nested contexts).

## User Stories

- As a Tuff author, I want to write `while` loops so I can repeat logic while a condition is true.
- As a Tuff author, I want `while` inside function bodies and nested blocks so control flow can be composed naturally with `if` and other block constructs.
- As a Tuff author, I want loop conditions to use familiar truthiness behavior so existing expression outcomes work naturally in conditions.
- As a Tuff author, I want the same statement rules inside `while` bodies as other statement blocks, so I can use `let`, assignment, `if`, `return`, and valid expression forms consistently.
- As a Tuff author, I want malformed `while` syntax to fail compilation so invalid programs are rejected early.

## Non-Goals

- No infinite-loop runtime guard is added.
- No new loop forms (e.g., `for`, `do-while`) are included in this change.
