# Specification 15: Functions

## Iteration Summary

Implement function declarations and calls with full type checking, forward references, and recursion support.

## User Stories

1. As a developer, I want to define reusable functions so that I can avoid code duplication
2. As a developer, I want to call functions with arguments so that I can compute results
3. As a developer, I want type-checked function calls so that I catch type errors at compile time
4. As a developer, I want recursive functions so that I can implement algorithms like factorial
5. As a developer, I want to call functions before they're defined so that I can organize code naturally
6. As a developer, I want functions that return pointers so that I can work with references
7. As a developer, I want Void functions for side effects so that I can perform actions without returning values

## Language Grammar Extensions

### Tokens

```
fn       - function keyword
ARROW    - => token for function body separator
Void     - void type keyword
COMMA    - , for parameter separation
```

### Syntax

```
Program ::= FunctionDecl* Expression

FunctionDecl ::= "fn" NAME "(" ParamList? ")" ":" Type FunctionBody

ParamList ::= Param ("," Param)*

Param ::= NAME ":" Type

FunctionBody ::= "=>" Expression ";"          // expression form
               | "=>" BlockExpr              // block form (no trailing semicolon)

FunctionCall ::= NAME "(" ArgList? ")"

ArgList ::= Expression ("," Expression)*

Type ::= PrimitiveType | PointerType | "Void"
```

## Semantics

### Function Declaration

- Functions are declared at top-level only (no nested functions)
- Function name must be unique (no redeclaration)
- Parameters are immutable and passed by value
- Return type is required
- Function body:
  - Expression form: `=> expr;` - the expression is the return value
  - Block form: `=> { statements; expr }` - final expression is return value
  - Void functions must use block form: `=> {}` with no final expression

### Function Calls

- Function calls are expressions: `add(1, 2)` can appear anywhere expressions are allowed
- Arguments are evaluated left-to-right
- Argument types must be assignable to parameter types (promotion allowed)
- Void function calls cannot appear in expression contexts (only as statements)

### Forward References

- Functions can call other functions defined later in the file
- Requires two-pass compilation:
  - Pass 1: Collect all function signatures
  - Pass 2: Parse function bodies and expressions

### Recursion

- Functions can call themselves recursively
- No tail-call optimization (generates standard JavaScript recursion)

### Scope

- Function parameters shadow global/outer variables
- Function bodies can access:
  - Their own parameters
  - Global variables (let bindings at top level)
  - Other functions
- No closure support (cannot access outer function's locals)

## Type Rules

1. **Function signature**: Return type must match final expression type (with assignability)
2. **Void function body**: Void functions must have `{}` body, not an expression
3. **Non-void function body**: Must end with an expression of compatible type
4. **Function call arity**: Number of arguments must match number of parameters
5. **Argument type**: Each argument type must be assignable to corresponding parameter type
6. **Void in expression context**: Error to use Void function call in expression
7. **Empty non-void body**: Error for non-Void function to have `{}` body
8. **Return type validation**: Final expression type must be assignable to declared return type

## Error Cases

### Declaration Errors

```tuff
// Redeclaration
fn add(x: I32) : I32 => x;
fn add(y: U8) : U8 => y;  // Error: cannot redeclare function 'add'

// Void with expression body
fn bad() : Void => 42;  // Error: Void function cannot have expression body

// Non-void with empty body
fn bad() : I32 => { }  // Error: function must return I32, got Void
```

### Call Errors

```tuff
// Wrong arity
fn add(x: I32, y: I32) : I32 => x + y;
add(1);  // Error: expected 2 arguments, got 1

// Wrong type
fn takesU8(x: U8) : U8 => x;
takesU8(1000);  // Error: 1000 cannot be assigned to U8

// Void in expression
fn doNothing() : Void => { };
let x = doNothing();  // Error: cannot use Void in expression context

// Unknown function
foo();  // Error: unknown function 'foo'
```

### Type Errors

```tuff
// Return type mismatch
fn bad() : U8 => 1000;  // Error: I32 (1000) not assignable to U8

// Incompatible final expression
fn bad() : I32 => { true };  // Error: Bool not assignable to I32
```

## Code Generation

### Function Declaration

```tuff
fn add(x: I32, y: I32) : I32 => x + y;
```

Generates:

```javascript
function add(x, y) {
  return x + y;
}
```

### Block Form

```tuff
fn factorial(n: I32) : I32 => {
  let mut result = 1;
  while (n > 0) {
    result = result * n;
    n = n - 1;
  }
  result
};
```

Generates:

```javascript
function factorial(n) {
  const n_wrapped = { val: n };
  let result = { val: 1 };
  while (n_wrapped.val > 0) {
    result.val = result.val * n_wrapped.val;
    n_wrapped.val = n_wrapped.val - 1;
  }
  return result.val;
}
```

### Void Function

```tuff
fn doNothing() : Void => { };
```

Generates:

```javascript
function doNothing() {}
```

### Function Call

```tuff
add(1, 2)
```

Generates:

```javascript
add(1, 2);
```

## Examples

### Valid Examples

```tuff
// Simple function
fn double(x: I32) : I32 => x * 2;
double(21)  // exits 42
```

```tuff
// Multiple parameters
fn add(first: I32, second: I32) : I32 => first + second;
add(10, 32)  // exits 42
```

```tuff
// Void function
fn doNothing() : Void => { };
doNothing();
42  // exits 42
```

```tuff
// Recursion
fn factorial(n: I32) : I32 => {
  if (n <= 1) 1 else n * factorial(n - 1)
};
factorial(5)  // exits 120
```

```tuff
// Forward reference
fn callFoo() : I32 => foo();
fn foo() : I32 => 42;
callFoo()  // exits 42
```

```tuff
// Pointer parameters
fn deref(ptr: *I32) : I32 => *ptr;
let x = 42;
let p = &x;
deref(p)  // exits 42
```

```tuff
// Pointer return
fn makePointer(mut x: I32) : *mut I32 => &mut x;
// Note: unsafe but allowed for now
```

```tuff
// Nested calls
fn double(x: I32) : I32 => x * 2;
fn add(a: I32, b: I32) : I32 => a + b;
add(double(5), double(7))  // exits 24
```

### Invalid Examples

```tuff
// Redeclaration
fn foo() : I32 => 1;
fn foo() : I32 => 2;  // Error
```

```tuff
// Wrong arity
fn add(x: I32, y: I32) : I32 => x + y;
add(1)  // Error
```

```tuff
// Type mismatch
fn takesU8(x: U8) : U8 => x;
takesU8(300)  // Error
```

```tuff
// Void in expression
fn nothing() : Void => { };
let x = nothing();  // Error
```

```tuff
// Empty non-void body
fn bad() : I32 => { }  // Error
```

```tuff
// Void with expression
fn bad() : Void => 42;  // Error
```

```tuff
// Return type mismatch
fn bad() : U8 => 300;  // Error
```

## Implementation Notes

### Two-Pass Compilation

1. **Pass 1 (Function Collection)**:
   - Scan tokens for function declarations
   - Extract function signatures (name, parameters, return type)
   - Build function environment map
   - Validate no redeclarations

2. **Pass 2 (Code Generation)**:
   - Parse function bodies with access to all function signatures
   - Parse top-level expressions
   - Generate JavaScript output

### Parameter Handling

- Parameters are NOT wrapped in `{val: ...}` objects initially
- If a parameter is used in a context requiring wrapping (e.g., pointer taking), wrap it on-demand
- Alternatively: always wrap in function body for consistency with let bindings

### Type Environment

- Extend binding environment to include function signatures
- Track function type separately from variable bindings
- Validate return type against final expression type

## Future Extensions (Deferred)

- Nested functions and closures
- Higher-order functions (function pointers)
- Generic/polymorphic functions
- Default parameters
- Variadic functions
- Function overloading
- Return statement for early exit
- Tail-call optimization
