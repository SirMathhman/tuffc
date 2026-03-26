# Iteration 13: While Statements

## Feature

Support while loops for repeated execution.

## Grammar

```ebnf
statement ::= ... | while-statement

while-statement ::= "while" "(" expr ")" (statement | statement-block)

statement-block ::= "{" statement* "}"
```

## Semantics

- **Syntax**: `while (condition) body` where body is either a single statement or a statement block
- **Condition**: Must be a Bool expression
- **Body**: Can be any statement (assignment, let, if-statement, another while, statement block)
- **Execution**: Evaluates condition; if true, executes body and repeats; if false, exits loop
- **No semicolon**: While statements do not require a trailing semicolon
- **Statement-only**: While is NOT an expression and cannot be used where an expression is expected

## Type Checking

1. **Condition type**: Must be Bool, otherwise throw type error
2. **Body**: No type constraints (statements don't have types)
3. **Expression context**: Using while where expression expected is syntax error

## User Stories

1. As a Tuff programmer, I want to write countdown loops with `while (condition) { ... }` so that I can repeat operations until a condition becomes false
2. As a Tuff programmer, I want to modify mutable variables inside while bodies so that I can implement counters and accumulators
3. As a Tuff programmer, I want nested while loops so that I can implement multi-dimensional iterations
4. As a Tuff programmer, I want both statement-block and single-statement while bodies so that I can choose the appropriate syntax
5. As a compiler user, I want type-checked Bool conditions so that I catch type errors at compile time
6. As a compiler user, I want clear errors when using while as an expression so that I understand while is statement-only

## Error Cases

- **Non-Bool condition**: `while (5) { }` throws "Type error: while condition must be Bool, got I32"
- **While as expression**: `let x = while (true) { };` throws syntax/type error
- **Missing parentheses**: `while true { }` throws syntax error

## Code Generation

Tuff `while (cond) { stmts }` → JavaScript `while (cond) { stmts }`

Direct translation to JS while loop.

## Examples

### Valid

```tuff
let mut x: U8 = 10U8;
while (x > 0U8) {
  x -= 1U8;
}
x  // exits 0
```

```tuff
let mut sum: U16 = 0U16;
let mut i: U16 = 1U16;
while (i <= 10U16) {
  sum += i;
  i += 1U16;
}
sum  // exits 55
```

```tuff
let mut x: U8 = 5U8;
while (x > 0U8) x -= 1U8;
x  // exits 0 (single statement body)
```

```tuff
while (false) {
  // never executes
}
0  // exits 0
```

### Invalid

```tuff
while (5) { }  // Type error: condition must be Bool
```

```tuff
let x = while (true) { };  // Syntax error: while is statement-only
```

```tuff
while (true) { }  // Valid syntax but infinite loop (not tested)
```

## Exit Code Behavior

- Program ending with while statement exits 0
- Program ending with expression after while exits with that expression value
