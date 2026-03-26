# Spec 12: Compound Assignment Operators

## Summary

Support compound assignment operators `+=`, `-=`, `*=`, `/=`, `&=`, `|=` for concise in-place mutation.

## Grammar

```
statement := ... | compound_assignment

compound_assignment := NAME ('+=' | '-=' | '*=' | '/=' | '&=' | '|=') expression ';'
```

## Semantics

### Desugaring

Compound assignment is syntactic sugar for the expanded form:

```
x op= expr   ⟹   x = x op expr
```

Where `op` is one of: `+`, `-`, `*`, `/`, `&`, `|`

### Type Rules

1. Variable must be **mutable** (`let mut`)
2. Variable must be **declared** (same error as regular assignment for unknown variables)
3. Type compatibility follows the expansion:
   - `x += rhs` requires `typeof(x + rhs)` compatible with `typeof(x)`
   - Same rules as regular assignment for RHS compatibility

### Operator Restrictions

**Arithmetic operators** (`+=`, `-=`, `*=`, `/=`):

- Only valid for **integer types** (U8, I8, U16, I16, U32, I32, U64, I64)
- Error if applied to Bool

**Bool operators** (`&=`, `|=`):

- Only valid for **Bool type**
- Error if applied to integers

## Valid Examples

```tuff
// Arithmetic compound assignment
let mut x: U16 = 10U16;
x += 5U8;        // U8 compatible with U16, becomes: x = x + 5U8
x -= 3U8;
x *= 2U8;
x /= 4U8;

// Bool compound assignment
let mut flag = true;
flag &= false;   // becomes: flag = flag && false
flag |= true;    // becomes: flag = flag || true

// Mixed widths
let mut total: U32 = 100U32;
total += 10U8;   // U8 → U32 widening allowed

// Multiple statements
let mut a = 5U8;
let mut b = 10U8;
a += 1U8;
b -= 2U8;
```

## Invalid Examples

```tuff
// Immutable variable
let x = 5U8;
x += 10U8;       // ERROR: cannot assign to immutable variable

// Undeclared variable
y += 5U8;        // ERROR: unknown variable "y"

// Arithmetic on Bool
let mut b = true;
b += false;      // ERROR: Bool not compatible with arithmetic operators

// Bool operators on integers
let mut x = 5U8;
x &= 10U8;       // ERROR: integer not compatible with bool operators

// Type incompatibility (narrowing)
let mut x: U8 = 10U8;
x += 500U16;     // ERROR: U16 not compatible with U8 (500 > 255)

// Chaining (not an expression)
let mut x = 0U8;
let mut y = 0U8;
x += y += 5U8;   // ERROR: compound assignment is statement, not expression
```

## User Stories

1. As a programmer, I want to use `+=` to add to a mutable variable, so that I can write concise increment logic
2. As a programmer, I want to use `-=`, `*=`, `/=` for arithmetic operations, so that I can write concise update logic
3. As a programmer, I want to use `&=` and `|=` for Bool variables, so that I can accumulate boolean conditions
4. As a programmer, I want type-compatible RHS values (e.g., U8 into U16), so that I can naturally mix integer widths
5. As a programmer, I want clear errors for immutable variables, so that I understand why compound assignment fails
6. As a programmer, I want clear errors for type mismatches (arithmetic on Bool, bool ops on integers), so that I catch mistakes early

## Codegen

Since compound assignment desugars to `x = x op expr`, the generated JavaScript is:

```
x += expr_code;    // Same as JS compound assignment
x -= expr_code;
x *= expr_code;
x /= expr_code;
x = x && expr_code;  // Bool operators use JS logical operators
x = x || expr_code;
```

Note: We can use JS compound assignment directly for arithmetic operators, but Bool operators require explicit expansion because Tuff's `&=` maps to `&&` (not bitwise `&`).
