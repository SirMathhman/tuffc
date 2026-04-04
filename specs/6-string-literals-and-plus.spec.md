# Spec 6: String Literals and + Operator

## Objective

Add string literal expressions (single- and double-quoted) and the `+` operator to the Tuff expression grammar. This unlocks the `compileTuffToJS` body in `main.tuff`, which must return string values and build strings through concatenation.

## Syntax

```
atom  ::= identifier | number | import.meta.url | string | "(" expr ")"
string ::= '"' char* '"' | "'" char* "'"
char   ::= any character except the opening quote and unescaped backslash
         | escape_sequence
escape_sequence ::= '\\n' | '\\t' | '\\r' | '\\\\' | '\\"' | "\\'"

expr  ::= atom suffix*
        | expr "+" expr      (left-associative, same token stream)

suffix ::= "." identifier | "(" arglist ")"
```

### Notes

- String syntax is identical to JS single/double-quoted strings for the supported escape sequences; compilation is verbatim.
- `+` is valid everywhere the expression grammar is used: `return`, `let` RHS, and `if` conditions.
- `+` compiles verbatim to JS `+`.
- Method calls on string literals work (e.g., `"hello".trim()`).
- Template literals (backtick strings) are deferred.
- No other arithmetic operators (`-`, `*`, `/`) are added in this iteration.

## What This Feature Must NOT Do

- Must not support template literals.
- Must not support `+` as a unary operator.
- Must not support arithmetic beyond `+`.
- Must not allow unclosed string literals — these must throw a compile error.
- Must not allow unknown escape sequences — these must throw a compile error.

## Compilation Target

```tuff
return "hello";
```

→

```js
return "hello";
```

```tuff
return "a" + "b";
```

→

```js
return "a" + "b";
```

```tuff
return source.replace("\n", "");
```

→

```js
return source.replace("\n", "");
```

## Relation to Prior Specs

Extends spec 4 (recursive-body-expressions): adds `string` as an atom type, and `+` as a new infix operator handled by the expression tokenizer and node parser.
Extends spec 5 (if-statements): `+` is valid in conditions.
