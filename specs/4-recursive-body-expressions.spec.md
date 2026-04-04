# Spec 4: Recursive expression parser for function bodies

## Problem

Body statements only support `return` with a narrow set of atoms. The new
construct `let trimmed = source.trim();` requires two new things:

1. `let name = <expr>;` as a body statement kind
2. A recursive expression grammar covering method calls, chained calls,
   function calls with arbitrary arguments

## Expression grammar

```
expr     ::= atom suffix*
atom     ::= identifier | number | 'import.meta.url'
suffix   ::= '.' identifier            (member access)
           | '(' arglist ')'           (call)
arglist  ::= ε | expr (',' ' ' expr)*
```

Special compilations:

- `import.meta.url` → `__tuff_import_meta_url`
- `read()` (identifier `read` + zero-arg call) → `__tuff_coerce(__tuff_read())`

## Body statement kinds

1. `return <expr>;` → `return <compiledExpr>;`
2. `let name = <expr>;` → `let name = <compiledExpr>;`

## Scope

- Any valid expression AST accepted.
- Invalid token (e.g. operator, string literal not yet) → compile error.
- Still no statement sequencing beyond simple let + return within body.
