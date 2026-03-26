# Spec 4: Let statements and type system

## Overview

Tuff programs can now be multi-statement sequences. `let` declares an immutable
variable with an explicit type annotation. Variables carry their type through
arithmetic so the type system can promote results correctly.

## Grammar

```
program        := statement* expression
statement      := let_stmt
let_stmt       := 'let' NAME ':' suffix '=' expression ';'
expression     := additive
additive       := multiplicative (('+' | '-') multiplicative)*
multiplicative := atom (('*' | '/') atom)*
atom           := integer_literal | read_call | variable
integer_literal := '-'? DIGITS suffix?
read_call       := 'read' '<' suffix '>' '(' ')'
variable        := NAME   (an already-declared variable)
suffix          := 'U8'|'I8'|'U16'|'I16'|'U32'|'I32'|'U64'|'I64'
```

The final expression (after all let statements) becomes the program's exit code.

## Type system

### Atom types

| Atom         | Inferred type        |
| ------------ | -------------------- |
| `42U8`       | U8                   |
| `42` (bare)  | I32                  |
| `read<T>()`  | T                    |
| variable `x` | declared type of `x` |

### Arithmetic result type

Result type = smallest IntSuffix whose range covers both operand ranges.

Ordering (by range width, ascending):
U8, I8, U16, I16, U32, I32, U64, I64

Promotion examples:

- U8 + U8 = U8
- I8 + I8 = I8
- U8 + I8 = I16 (smallest type covering [−128, 255])
- U8 + U16 = U16
- I8 + U16 = I32 (I16 covers I8 but not U16)
- U16 + I16 = I32
- U8 + I32 = I32
- I8 + U32 = I64
- U16 + I32 = I32
- I16 + U32 = I64
- U32 + I32 = I64
- U64 + U64 = U64
- I64 + I64 = I64
- U64 + I64 = compile error (no type covers both)

### Let type compatibility

`let x: T = expr` is valid when `T`'s range fully covers the inferred type's
range (i.e. inferred_min >= T_min AND inferred_max <= T_max).

Example: `let x: U16 = 5U8;` is valid because U16 covers U8.
Example: `let x: U8 = 5U16;` is a **type error**.
Example: `let x: I32 = read<U8>() + read<I8>();` is valid (U8+I8=I16, I32⊇I16).

### Variable shadowing

A second `let` with the same name shadows the previous declaration.

## Code generation

`let x: T = expr;` compiles to `const x = <expr>;`
The final expression compiles to `return <expr>;`

## Error cases (compile time)

- Unknown variable name → `Type error: unknown variable "x"`
- Declared type not compatible with inferred type → `Type error: cannot assign <inferred> to <declared>`
- Arithmetic with no covering type → `Type error: no integer type covers <A> and <B>`
- Last statement is a let → `Syntax error: program must end with an expression`
