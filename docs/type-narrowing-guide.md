# Type Narrowing Guide

## Overview

Type narrowing is a **flow-sensitive type refinement** mechanism that allows the Tuff compiler to track more precise types for variables within specific control flow branches. This enables safe access to union type variants without runtime panics or unsafe casts.

## The `is` Operator

### Syntax

```tuff
<expression> is <Type>
```

- **Returns**: `Bool` — `true` if `<expression>` is an instance of `<Type>`, `false` otherwise
- **Side Effect**: Narrows the type of `<expression>` within the true branch (if any)

### Runtime Behavior

Union types in Tuff are discriminated via a compiler-injected `__tag` field:

```javascript
// JavaScript code generated for:
// struct Ok<T> { value: T; }
// struct Err<E> { error: E; }

const my_result = { __tag: "Ok", value: 42 };

// `result is Ok` becomes:
my_result && my_result.__tag === "Ok"  // true
```

For C targets, the `__tag` field is emitted as an enum or string constant in the generated struct.

## Type Narrowing in Control Flow

### Basic If-Then-Else Narrowing

When the `is` operator appears in an `if` condition, the compiler narrows the type of the checked expression in the corresponding branch:

```tuff
fn unwrap_or<T, E>(result: Result<T, E>, default_value: T) : T => {
    if (result is Ok) {
        // Within this block:
        // - result's type is narrowed from Result<T, E> to Ok<T>
        // - Accessing result.value is type-safe
        result.value
    } else {
        // Within this block:
        // - result's type is narrowed from Result<T, E> to Err<E>
        // - Accessing result.error is type-safe (if needed)
        default_value
    }
}
```

### Multiple Type Checks

You can chain multiple `is` checks to discriminate complex union types:

```tuff
type Status = Active | Inactive | Pending | Failed;

fn describe_status(s: Status) : *Str => {
    if (s is Active) {
        "System is active"
    } else if (s is Inactive) {
        "System is inactive"
    } else if (s is Pending) {
        "System is pending"
    } else {
        // Exhaustiveness: compiler knows s must be Failed here
        "System failed"
    }
}
```

### Negated Checks

The `!` operator works with `is` to narrow in the opposite direction:

```tuff
fn is_error<T, E>(result: Result<T, E>) : Bool => {
    !(result is Ok)  // Equivalent to: result is Err
}

fn handle_result<T, E>(result: Result<T, E>) => {
    if (!(result is Ok)) {
        // result is narrowed to Err<E>
        console_log("Error occurred: ");
        console_log(result.error);
    }
}
```

## Type Narrowing Scope

### Local Scope Only

Type narrowing applies **only within the branch where the check succeeds**. After the branch exits, the original union type is restored:

```tuff
fn example<T, E>(result: Result<T, E>) => {
    if (result is Ok) {
        let x = result.value;  // OK: result is Ok<T> here
    }
    
    // ERROR: result is Result<T, E> again here (not narrowed)
    // let y = result.value;  // Compile error: Result<T, E> has no .value field
}
```

### Nested Scopes

Narrowing persists through nested blocks within the same branch:

```tuff
fn nested_example<T>(opt: Option<T>) => {
    if (opt is Some) {
        {
            {
                let val = opt.value;  // OK: opt is still Some<T>
            }
        }
    }
}
```

## Implementation Details

### AST Node Kind

The `is` operator is represented as `NK_IS_EXPR` (node kind 33):

```tuff
// From parser_kinds.tuff
const NK_IS_EXPR : I32 = 33;
```

### Parser

Parsing logic in `parser_expr.tuff` (lines 170-179):

```tuff
if (p_at(TK_KEYWORD, "is")) {
    p_advance();  // consume 'is'
    let is_node = node_new(NK_IS_EXPR);
    node_set_data1(is_node, left);           // LHS: expression being checked
    node_set_data2(is_node, p_parse_pattern()); // RHS: pattern (type)
    left = is_node;
}
```

### Type Checking

Type narrowing implementation in `typecheck_impl.tuff` (lines 826-843):

```tuff
// Simplified logic:
if (cond is NK_IS_EXPR) {
    let ident = node_get_data1(cond);  // Get checked identifier
    let pattern = node_get_data2(cond);
    
    // Narrow type in true branch:
    let narrowed_type = extract_type_from_pattern(pattern);
    local_types.map_set(ident_name, narrowed_type);
    
    typecheck_block(then_branch);
    
    // Restore original type after branch:
    local_types.map_remove(ident_name);
    
    typecheck_block(else_branch);
}
```

### Code Generation

JavaScript codegen (`codegen_expr.tuff`, line 388):

```tuff
fn emit_pattern_guard(value_expr: *Str, pattern: I32) : (Bool, *Str) => {
    if (node_get_kind(pattern) == NK_NAME_PAT) {
        let type_name = node_get_data1(pattern).ident_get_name();
        // Generate: value_expr && value_expr.__tag === "TypeName"
        // ...
    }
    // ...
}
```

C backend (`codegen_c_impl.tuff`, line 680) follows similar logic but emits C-compatible struct tag checks.

## Common Patterns

### Result Helpers

```tuff
// Standard library helpers in tuff-core/Result.tuff

fn is_ok<T, E>(result: Result<T, E>) : Bool => {
    result is Ok
}

fn is_err<T, E>(result: Result<T, E>) : Bool => {
    result is Err
}

fn unwrap_or<T, E>(result: Result<T, E>, default_value: T) : T => {
    if (result is Ok) result.value else default_value
}
```

### Option Helpers

```tuff
fn is_some<T>(opt: Option<T>) : Bool => {
    opt is Some
}

fn is_none<T>(opt: Option<T>) : Bool => {
    opt is None
}

fn unwrap_or_default<T>(opt: Option<T>, default_value: T) : T => {
    if (opt is Some) opt.value else default_value
}
```

### Custom Union Types

```tuff
type Command = Run | Stop | Restart;

fn execute(cmd: Command) => {
    if (cmd is Run) {
        start_process();
    } else if (cmd is Stop) {
        stop_process();
    } else if (cmd is Restart) {
        stop_process();
        start_process();
    }
}
```

## Limitations

### No Complex Pattern Matching

The `is` operator only checks type identity, not structural patterns:

```tuff
// OK:
if (result is Ok) { ... }

// NOT SUPPORTED (would require match expression):
// if (result is Ok { value: 42 }) { ... }
```

Use `match` expressions for structural pattern matching (when implemented).

### No Multi-Variable Narrowing

Type narrowing only affects the immediate variable being checked:

```tuff
fn example<T>(opt1: Option<T>, opt2: Option<T>) => {
    let both_some = (opt1 is Some) && (opt2 is Some);
    
    if (both_some) {
        // ERROR: narrowing doesn't propagate through intermediate variables
        // let x = opt1.value;  // Compile error
    }
    
    // CORRECT:
    if ((opt1 is Some) && (opt2 is Some)) {
        let x = opt1.value;  // OK: opt1 narrowed to Some<T>
        let y = opt2.value;  // OK: opt2 narrowed to Some<T>
    }
}
```

### Narrowing Cleared on Mutation

If a narrowed variable is reassigned, the narrowing is invalidated:

```tuff
fn mutation_example<T, E>(result: Result<T, E>) => {
    if (result is Ok) {
        let x = result.value;  // OK
        
        result = Err { error: some_error };  // Reassignment
        
        // ERROR: result is no longer guaranteed to be Ok<T>
        // let y = result.value;  // Compile error
    }
}
```

## Testing

### Test Files

- **Basic Tests**: `src/test/tuff/cases/is-operator-basic.tuff`
- **Stdlib Result Tests**: `src/test/tuff/cases/stdlib-result.tuff`
- **Spec Tests**: `src/test/js/spec-semantics-exhaustive.ts`
  - Test case: `is:basic-type-discrimination`
  - Test case: `is:type-narrowing-branches`

### Running Tests

```powershell
cd Tuffc

# Core test suite (includes is operator tests):
npm run test

# Full gate check:
npm run check
```

## References

- **SPECIFICATION.md §2.1**: Type System (Type Narrowing section)
- **SPECIFICATION.md §4.7**: Result and Option Handling (`is` operator usage)
- **Source Files**:
  - `src/main/tuff/runtime_lexer.tuff` (line 218): Keyword recognition
  - `src/main/tuff/parser_expr.tuff` (lines 170-179): Parsing
  - `src/main/tuff/typecheck_impl.tuff` (lines 826-843): Type narrowing logic
  - `src/main/tuff/codegen_expr.tuff` (line 388): JavaScript codegen
  - `src/main/tuff/codegen_c_impl.tuff` (line 680): C codegen
