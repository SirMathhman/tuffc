# Specification 14: Pointer Types

## Overview

Adds support for pointer types and operations: immutable pointers (`*T`), mutable pointers (`*mut T`), address-of operators (`&`, `&mut`), and dereference operator (`*`).

## User Stories

1. Create pointers to immutable variables to enable reference passing
2. Create mutable pointers and modify pointee values indirectly
3. Work with nested pointers for complex data structures
4. Compare pointers to check if they refer to the same location
5. Type safety prevents mutation through immutable pointers
6. Type safety prevents taking mutable references to immutable variables

## Grammar

```
Type := PrimitiveType | PointerType
PointerType := "*" "mut"? Type
PrimaryExpr := ... | AddressOf | Dereference
AddressOf := "&" "mut"? NAME
Dereference := "*" PrimaryExpr
```

## Semantics

### Pointer Types

- `*T`: Immutable pointer to type T (cannot assign through it)
- `*mut T`: Mutable pointer to type T (can assign through it)
- Nested pointers supported: `**I32`, `*(*mut I32)`, `*mut *I32`, etc.

### Address-Of Operators

- `&x`: Takes immutable address of variable x, produces `*T` where T is the type of x
- `&mut x`: Takes mutable address of variable x, produces `*mut T` where T is the type of x
- Can only take address of variables (not arbitrary expressions)
- `&mut x` requires x to be declared with `mut` keyword

### Dereference Operator

- `*ptr`: Dereferences pointer, evaluating to the pointed-to value
- Can be used as:
  - R-value: `let y = *ptr;` (read through pointer)
  - L-value: `*ptr = 42;` (write through pointer, requires `*mut T`)
- Can be chained for nested pointers: `**pp`, `***ppp`, etc.

### Comparison

- Pointers can be compared using `==` and `!=`
- Compares pointer identity (same address), not value equality
- Both operands must be pointer types
- Result is Bool type

## Type Rules

1. **Address-of immutable variable**:
   - `let x: T = ...; let p: *T = &x;` ✓ Valid
2. **Address-of mutable variable (immutable pointer)**:
   - `let mut x: T = ...; let p: *T = &x;` ✓ Valid
3. **Address-of mutable variable (mutable pointer)**:
   - `let mut x: T = ...; let p: *mut T = &mut x;` ✓ Valid
4. **Address-of immutable variable (mutable pointer)**:
   - `let x: T = ...; let p: *mut T = &mut x;` ✗ Error: cannot take mutable address of immutable variable
5. **Dereference for reading**:
   - `let p: *T = ...; *p` ✓ Valid (produces value of type T)
   - `let p: *mut T = ...; *p` ✓ Valid (produces value of type T)
6. **Dereference for writing**:
   - `let p: *mut T = ...; *p = value;` ✓ Valid (requires value compatible with T)
   - `let p: *T = ...; *p = value;` ✗ Error: cannot assign through immutable pointer

7. **Pointer in arithmetic operations**:
   - `ptr1 + ptr2`, `ptr * 2`, etc. ✗ Error: pointers cannot be used in arithmetic

8. **Pointer in boolean operations**:
   - `ptr1 && ptr2`, `!ptr`, etc. ✗ Error: pointers cannot be used in boolean operations

9. **Pointer as if-condition**:
   - `if (ptr) ...` ✗ Error: condition must be Bool, not pointer

10. **Program ending with pointer**:
    - `let x = 100; &x` ✗ Error: program must end with integer or Bool, not pointer

11. **Pointer comparison**:
    - `ptr1 == ptr2`, `ptr1 != ptr2` ✓ Valid (produces Bool)
    - Dereferenced values: `*ptr1 == *ptr2` ✓ Valid (compares values, not pointers)

## Code Generation (JavaScript Target)

### Pointer Representation

Pointers are represented as JavaScript objects containing a reference:

```javascript
// let mut x = 100; let p = &mut x;
let x = { val: 100 };
let p = x;
```

### Address-Of

Both `&x` and `&mut x` generate references to the wrapper object:

```javascript
// Tuff: let x = 100; let p: *I32 = &x;
let x = { val: 100 };
let p = x;

// Tuff: let mut y = 200; let q: *mut I32 = &mut y;
let y = { val: 200 };
let q = y;
```

### Dereference (Read)

Reading through a pointer accesses the `.val` property:

```javascript
// Tuff: *p
p.val;
```

### Dereference (Write)

Writing through a pointer assigns to the `.val` property:

```javascript
// Tuff: *p = 42;
p.val = 42;
```

### Nested Pointers

Nested pointers are wrapped objects containing wrapped objects:

```javascript
// Tuff: let x = 100; let p = &x; let pp = &p;
let x = { val: 100 };
let p = { val: x };
let pp = { val: p };

// Tuff: **pp
pp.val.val.val;
```

### Comparison

Pointer comparison uses JavaScript `===` and `!==`:

```javascript
// Tuff: p1 == p2
p1 === p2;

// Tuff: p1 != p2
p1 !== p2;
```

## Examples

### Valid Programs

```tuff
// Basic immutable pointer
let x = 100;
let y: *I32 = &x;
*y
// Output: 100
```

```tuff
// Mutable pointer with assignment
let mut x = 100;
let y: *mut I32 = &mut x;
*y = 42;
x
// Output: 42
```

```tuff
// Nested pointers
let x = 100;
let p: *I32 = &x;
let pp: **I32 = &p;
**pp
// Output: 100
```

```tuff
// Pointer comparison (same variable)
let x = 100;
let p1: *I32 = &x;
let p2: *I32 = &x;
p1 == p2
// Output: 1 (true)
```

```tuff
// Pointer comparison (different variables)
let x = 100;
let y = 100;
let p1: *I32 = &x;
let p2: *I32 = &y;
p1 != p2
// Output: 1 (true)
```

```tuff
// Dereferenced value comparison
let x = 100;
let y = 100;
let px: *I32 = &x;
let py: *I32 = &y;
*px == *py
// Output: 1 (true - values are equal)
```

```tuff
// Mutable pointer reading
let mut x = 50;
let p: *mut I32 = &mut x;
*p + 10U8
// Output: 60
```

```tuff
// Multiple operations with mutable pointer
let mut x = 10;
let p: *mut I32 = &mut x;
*p = *p * 2;
x
// Output: 20
```

### Invalid Programs

```tuff
// Error: cannot take mutable address of immutable variable
let x = 100;
let p: *mut I32 = &mut x;
```

```tuff
// Error: cannot assign through immutable pointer
let mut x = 100;
let p: *I32 = &x;
*p = 42
```

```tuff
// Error: cannot take address of expression
let p: *I32 = &(100 + 200);
```

```tuff
// Error: cannot use pointers in arithmetic
let x = 100;
let p: *I32 = &x;
p + 1
```

```tuff
// Error: cannot use pointer in boolean operation
let x = 100;
let p: *I32 = &x;
!p
```

```tuff
// Error: if-condition must be Bool, not pointer
let x = 100;
let p: *I32 = &x;
if (p) x else 0
```

```tuff
// Error: program cannot end with pointer
let x = 100;
&x
```

## Implementation Notes

### No Borrow Checking (This Iteration)

- Multiple borrows (immutable or mutable) are allowed simultaneously
- No aliasing rules enforced
- No lifetime checking
- Borrow checker deferred to future iteration

### Type Checking Only

Focus on type safety:

- Ensure `&mut` only on `mut` variables
- Ensure assignment through pointer only with `*mut T`
- Prevent pointers in arithmetic/boolean contexts
- Require integer or Bool for program exit value

### Precedence

Follow C operator precedence:

- `*` (dereference) and `&` (address-of): same as unary operators (right-to-left)
- Higher precedence than arithmetic operators
- Lower precedence than function calls (when added)

## Future Enhancements

1. **Null pointers**: Union type `*T | null` with refinement types
2. **Borrow checker**: Enforce "one mutable OR many immutable" aliasing rules
3. **Lifetime checking**: Prevent dangling pointers from escaped scope
4. **Pointer arithmetic**: For array access (when arrays are added)
5. **Smart pointers**: Reference counting, unique ownership, etc.
