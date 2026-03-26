# Spec 9: Block expressions

## Overview

A block `{ stmts* expr }` is a first-class expression that evaluates its body
sequentially and produces the value of its final expression. Blocks introduce
a new scope for variable declarations.

## Grammar

```
atom := ... | block
block := '{' statement* expression '}'
```

Blocks may appear anywhere an expression is allowed: RHS of let, final
program expression, operands of arithmetic/bool/comparison operators.

## Scoping rules

- Variables declared inside a block are not visible after the closing `}`.
- A block inherits all bindings visible at the point of use.
- A block may shadow an outer variable by declaring one with the same name.
  After the block, the outer binding is restored.
- A block may read and reassign mutable outer variables.

## Type rules

- The type of a block is the type of its final expression.
- All statement rules (let, let mut, reassignment, type compatibility) apply
  identically inside blocks.
- A block must end with an expression — empty blocks and blocks ending in a
  statement are compile errors.

## Code generation

Compiles to an IIFE:

```
{ let y: T = expr; y }  →  (() => { const y = <expr>; return y; })()
```

Outer mutable variables are naturally captured by the JS closure.

## Error cases

- `{ }` → `Syntax error: block must end with an expression`
- `{ let x: U8 = 5U8; }` → `Syntax error: block must end with an expression`
- Using a block-local variable after `}` → `Type error: unknown variable "z"`
