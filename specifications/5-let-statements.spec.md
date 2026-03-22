# 5 — let statements and variable usage

## Objective

Support statement-based programs with variable declarations, including:

- `executeTuff("let x : U8 = read<U8>(); x + x", "100 50")` => `200`

## User Stories

- As a Tuff user, I want to declare variables with `let` and a type annotation.
- As a Tuff user, I want to use declared variables inside the final arithmetic expression.
- As a compiler maintainer, I want static checks for undeclared names and duplicate declarations.

## Grammar (current scope)

Program:

- zero or more `let` statements, then one final expression

Statement:

- `let <identifier> : <Type> = <Initializer>;`

Initializer:

- `read<Type>()`
- integer literal with type suffix (existing literal syntax)

Expression:

- terms: identifiers, typed literals, `read<Type>()`
- operators: `+ - * /`
- precedence: standard (`*`/`/` before `+`/`-`)

## Types

Supported types:

- `U8 U16 U32 U64 I8 I16 I32 I64`

Type rules:

- Initializer must be compatible with annotated type.
- Literal range checks follow existing rules.

## Name rules

- Identifier must be declared before use.
- Duplicate `let` declaration of same name in same program is compile error.

## Runtime behavior

- Reads consume stdin tokens left-to-right.
- Extra stdin tokens are ignored.
- `/` uses integer division truncating toward zero.
- Division-by-zero behavior remains undefined in this iteration.

## Constraints

- Keep `compileTuffToTS(source)` source-only (no stdin param).
- Keep `executeTuff(source, stdIn)` as runtime input entrypoint.
