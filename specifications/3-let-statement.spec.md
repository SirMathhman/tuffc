# Spec 3: Let Statements and Variables

## Syntax

```
program    = (statement WS)* final_expr
statement  = "let" WS identifier (WS ":" WS type)? WS "=" WS expr WS ";"
expr       = binary_expr | operand
operand    = read_expr | numeric_suffix_literal | identifier
identifier = [a-zA-Z_][a-zA-Z0-9_]*
type       = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64"
```

## Type Inference and Annotations
- The type annotation (`: T`) in a `let` statement is optional.
- If omitted, the variable's type is inferred from the right-hand side (RHS) expression.
- If provided, the RHS expression must be **assignable** to the annotated type.
  - "Assignable" means that the acceptable range of values for the RHS type is completely contained within the acceptable range of values for the LHS (annotated) type.
  - For example, `U8` (0 to 255) is assignable to `U16` (0 to 65535).
  - `U16` is NOT assignable to `U8`.
  - A compile error is emitted if the RHS type is not assignable to the declared type.

## Expressions and Variables
- Variables can be referenced interchangeably with literals and `read<T>()` across all operands.
- Attempting to reference an undeclared variable is a **compile error**.
- **Shadowing** is allowed: a `let` statement can declare a variable with the same name as an already existing variable. The new binding shadows the old one for subsequent statements.
- Variables map to `number` or `bigint` in the generated TypeScript, corresponding to their Tuff type. Wait, the Tuff compiler translates code into JS inside an IIFE. Variables will be emitted as JS variables (e.g. `const varName = ...;`).

## Return Value
A Tuff program consists of zero or more `let` statements followed by exactly one final expression. The execution result of the program is the evaluated value of that final expression.

## Examples
| Program | stdin | Result |
|---|---|---|
| `let x : U8 = read<U8>() + 50U8; x` | `"100"` | `150` |
| `let x = 100U8; x + x` | — | `200` |
| `let x = 10U8; let y: U16 = x; y` | — | `10` |
| `let x = 10U8; let x = 20U16; x` | — | `20` (shadowing) |
| `let x : U8 = 100U16; x` | — | Compile error (U16 not assignable to U8) |
| `let x = 10U8; x + y` | — | Compile error (y undeclared) |
