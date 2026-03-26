# Spec 10: Statement blocks

## Overview

A statement block `{ statement* }` groups zero or more statements and executes them
sequentially without producing a value. Statement blocks introduce a new scope
for variable declarations.

This feature exists alongside block expressions:

- block expression: `{ statement* expression }`
- statement block: `{ statement* }`

## User stories

- As a Tuff programmer, I want to group statements in `{ ... }` without needing
  a final expression.
- As a Tuff programmer, I want statement blocks to introduce a nested scope so
  inner bindings disappear after `}`.
- As a Tuff programmer, I want statement blocks to be nestable anywhere a
  statement is allowed.
- As a Tuff programmer, I want a statement-only program to be valid and exit
  with `0`.
- As a Tuff programmer, I do not want bare expression statements like `{ x }`,
  so brace syntax remains unambiguous.

## Grammar

```text
program         := statement* [expression]
statement       := let_stmt | assign_stmt | statement_block
statement_block := '{' statement* '}'
block_expr      := '{' statement* expression '}'
```

A `{ ... }` in statement position is a statement block only when its contents
are valid statements. Bare expression statements are not allowed.

## Scoping rules

- Variables declared inside a statement block are not visible after the closing
  `}`.
- A statement block inherits all bindings visible at the point of use.
- A statement block may shadow outer variables.
- A statement block may read and reassign mutable outer variables.
- Statement blocks may be nested arbitrarily.

## Program result

- If a program ends with an expression, that expression determines the exit code
  as before.
- If a program contains only statements, it is valid and exits with `0`.

## Invalid forms

- `{ x }` in statement position is invalid because bare expression statements are
  not allowed.
- Non-mutable assignment rules and type compatibility rules are unchanged.
