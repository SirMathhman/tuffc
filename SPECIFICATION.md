# System Specification: Tuff Language & Tuffc Compiler

## 1. Purpose and Scope

### 1.1 Purpose

Tuff is a systems programming language that improves on Rust by:

- **Eliminating `unsafe`**: All unsafe operations exist only in C/C++/JS via FFI—never in user-written Tuff code.
- **No panics**: The language is designed so that no well-typed program can panic. Array bounds, integer overflow, and division by zero are all prevented at compile time via refinement types.
- **Platform-specific code**: First-class `expect`/`actual` declarations (KMP-style) for cross-platform development.
- **Simplified lifetime ergonomics**: Lifetime blocks scope lifetime parameters to regions of code rather than annotating individual references.

### 1.2 Stakeholders

- **Primary user**: Systems programmers seeking Rust-level safety without `unsafe` escape hatches.

### 1.3 Success Criteria

- A self-hosting compiler: the Tuffc compiler, initially bootstrapped in TypeScript, must eventually compile itself when rewritten in Tuff.
- No `unsafe` code paths in user-facing Tuff—all unsafe operations are delegated to FFI targets (C, C++, JavaScript).

### 1.4 File Extension

`.tuff`

---

## 2. Domain Model

### 2.1 Type System Overview

Tuff has a **static type system** with full **type inference**. All types are resolved at compile time. There are no implicit conversions—all conversions must be explicit.

### 2.2 Primitive Types

| Type    | Description                                                             |
| ------- | ----------------------------------------------------------------------- |
| `U8`    | Unsigned 8-bit integer                                                  |
| `U16`   | Unsigned 16-bit integer                                                 |
| `U32`   | Unsigned 32-bit integer                                                 |
| `U64`   | Unsigned 64-bit integer                                                 |
| `I8`    | Signed 8-bit integer                                                    |
| `I16`   | Signed 16-bit integer                                                   |
| `I32`   | Signed 32-bit integer                                                   |
| `I64`   | Signed 64-bit integer                                                   |
| `F32`   | 32-bit floating point                                                   |
| `F64`   | 64-bit floating point                                                   |
| `USize` | Unsigned pointer-width integer (platform-dependent)                     |
| `ISize` | Signed pointer-width integer (platform-dependent)                       |
| `Bool`  | Boolean (`true` / `false`)                                              |
| `Char`  | Character (size is platform-dependent: U8 on native, U16 on JS targets) |

`Void` is a **return type marker only** — it is not a first-class type and cannot be used as a value type, pointer target, or array element.

There is **no built-in string type**. Strings are represented as `*[Char]` (immutable slice of `Char`).

### 2.3 Composite Types

#### Structs (Named Scopes)

Structs may be defined explicitly or implicitly via constructor functions. Both produce the same "named scope" — defining both for the same name is a compile error.

**Explicit definition:**

```tuff
struct Point {
    x : I32;
    y : I32;
}
```

Explicit structs support struct literal creation: `let p = Point { x: 1, y: 2 };`

**Constructor function (implicit struct):**

```tuff
fn Point(x : I32, y : I32) => {
    fn manhattan(*this) => x + y;
    this
}
```

The `this` keyword captures all local bindings (values and functions) in scope and returns them as a struct. Functions captured this way have an implicit `*this` receiver and are callable via dot syntax:

```tuff
let p = Point(3, 4);
p.manhattan(); // 7
```

**Struct fields may include function pointers with explicit receivers:**

```tuff
struct Widget {
    value : I32;
    compute : *(*this) => I32;  // function pointer with receiver
}
```

- `*(...) => T` is a **function pointer** type.
- `(...) => T` is a **closure** type.

#### Simple Enums

C-style enums with named variants:

```tuff
enum Color { Red, Green, Blue }
```

#### Tuples

```tuff
let pair : (I32, Bool) = (42, true);
let (a, b) = pair; // destructuring
```

#### Object (Singleton)

One instance per permutation of type parameters:

```tuff
object None<T> {}
```

#### Type Aliases

```tuff
type Name = *[Char];
```

### 2.4 Pointer Types

| Syntax     | Semantics          |
| ---------- | ------------------ |
| `*T`       | Immutable borrow   |
| `*mut T`   | Mutable borrow     |
| `*move T`  | Owning pointer     |
| `T` (bare) | Value type (moved) |

- **Dereferencing**: `*ptr`
- **Field access**: Auto-dereference through any number of pointer layers — `ptr.field` works regardless of pointer depth.
- **Address-of / slice conversion**: `&value`

### 2.5 Union Types

**Standard union** — value can be any of the constituent types:

```tuff
type Option<T> = Some<T> | None<T>;
```

**Tryable union** (`|>`) — the right-hand side is the early-return type for the `?` operator:

```tuff
type Result<T, X> = Ok<T> |> Err<X>;
```

Using `?` on a `Result` value will:

- Unwrap `Ok<T>` and yield the inner value.
- Early-return with `Err<X>` if the value is an error.

This generalizes to any type defined with `|>`.

### 2.6 Refinement Types

Types may be refined with compile-time predicates. Refinement types are **central to Tuff's no-panic guarantee** — they are required (not optional) for operations that could traditionally cause runtime failures.

```tuff
let x : I32 > 100 = 200;

fn get<T>(array : *[T], index : USize < array.length) => array[index];
```

- **Operators in refinements**: `>`, `<`, `>=`, `<=`, `==`, `!=`, `&&`, `||`
- **Dependent references**: Refinements can reference other parameters (e.g., `index < array.length`).
- **Checked at compile time** — verification mechanism is TBD (see Open Questions).
- **Not in Stage 0 bootstrap compiler**.

#### Required Refinements (No-Panic Rules)

**Array indexing**: `array[index]` is a compile error unless `index` is provably `USize < array.length`:

```tuff
fn get<T>(array : *[T], index : USize < array.length) => array[index]; // OK
fn bad<T>(array : *[T], index : USize) => array[index]; // COMPILE ERROR
```

**Integer arithmetic**: `a + b` requires proving no overflow without evaluating the expression. One of these must hold:

- `a <= Max<TypeOf<A>, TypeOf<B>> - b`, OR
- `b <= Max<TypeOf<A>, TypeOf<B>> - a`

Similar rules apply for subtraction (underflow) and multiplication.

**Division**: The divisor must be provably non-zero:

```tuff
fn divide(a : I32, b : I32 != 0) => a / b; // OK
fn bad(a : I32, b : I32) => a / b; // COMPILE ERROR
```

**No `.unwrap()`**: `Option<T>` and `Result<T, X>` have no unwrap method. Values must be extracted via pattern matching or the `?` operator.

#### Arithmetic Refinement Rules

All arithmetic operations require compile-time proof of safety. There is **no opt-in wrapping arithmetic** — overflow is always prevented.

| Operation          | Required Proof                                                   |
| ------------------ | ---------------------------------------------------------------- |
| `a + b`            | `a + b <= Max` — prove via `a <= Max - b` OR `b <= Max - a`      |
| `a - b` (unsigned) | `a >= b`                                                         |
| `a - b` (signed)   | No underflow past `Min`                                          |
| `a * b`            | `a * b <= Max` — establish via `if (a <= Max / b)` flow analysis |
| `a / b`            | `b != 0`                                                         |
| `a % b`            | `b != 0`                                                         |
| `-a` (negation)    | `a != Min` (for signed types, since `-Min` overflows)            |
| `a << b`           | `b < bit_width` (e.g., `b < 32` for I32)                         |
| `a >> b`           | `b < bit_width`                                                  |

Refinements are established through **flow analysis**. An `if` statement creates a refinement scope:

```tuff
fn safeDivide(a : I32, b : I32) : Option<I32> => {
    if (b != 0) {
        // b is refined to I32 != 0 in this branch
        Some { value: a / b }
    } else {
        None {}
    }
};
```

#### Numeric Type Widening

Implicit widening is allowed when the target type's range contains the source type's range:

| Widening                  | Valid? | Reason                                     |
| ------------------------- | ------ | ------------------------------------------ |
| `I8` → `I32`              | Yes    | I32 range contains I8 range                |
| `I32` → `I8`              | No     | Compile error (must prove value fits)      |
| `I32 \| U32` → `I64`      | Yes    | I64 range contains both I32 and U32 ranges |
| `I64 + U64`               | Error  | No primitive type holds both ranges        |
| `Some<T>` → `Option<T>`   | Yes    | Union widening                             |
| `Err<X>` → `Result<T, X>` | No     | T cannot be inferred                       |

Pointer arithmetic (e.g., `slice + index`) is valid when bounds are proven via refinement types.

### 2.7 Arrays and Slices

| Syntax      | Description                        |
| ----------- | ---------------------------------- |
| `[T; N]`    | Fixed-size array of N elements     |
| `*[T]`      | Immutable slice (pointer to array) |
| `*mut [T]`  | Mutable slice                      |
| `*move [T]` | Owning slice                       |

- `[T]` (bare dynamic array) does **not** exist.
- Arrays must always be initialized: `let arr = [() => 0; 3];` (initializer is `() => T`).
- Index with `[]`.
- Convert fixed array to slice with `&`.

### 2.8 Destructors and the `then` Keyword

Destructors are attached to types using `then`:

```tuff
fn drop(this : *move I32) => { /* cleanup */ };
type DroppableI32 = I32 then drop;
```

`then` is composable:

```tuff
type X = A then cleanup1 then cleanup2;
```

When a value of a `then`-annotated type goes out of scope, the attached function is called with `*move` semantics.

---

## 3. Functional Requirements

### 3.1 Functions

**Syntax:**

```tuff
fn name(param1 : Type1, param2 : Type2) : ReturnType => expr;

fn name(param1 : Type1, param2 : Type2) : ReturnType => {
    // block body
    expr
};
```

- **Return type inference**: Return type annotation may be omitted.
- **Arguments**: Positional only.
- **Overloading**: Supported.
- **Nested functions**: Allowed. Closures are nested functions.
- **Higher-order functions**: Supported.

**Variadic functions:**

```tuff
fn findLength<T, L : USize>(...array : [T; L]) => array.length;
```

The length `L` is monomorphized — each call site generates a specialized function.

**Methods:**

Any function with a parameter named `this` is a method:

```tuff
fn length(*this : *Point) : F64 => { /* ... */ };
```

Called via dot syntax: `point.length()`. The compiler provides an implicit `*this` receiver.

For mutable methods, use `*mut this`:

```tuff
fn set_x(*mut this : *mut Point, x : I32) => { /* ... */ };
```

**Method resolution order**:

1. Struct field (function pointer) — checked first.
2. Free function with matching `this` parameter — checked second.

**Closures:**

Closures are nested functions with capture lists:

```tuff
fn capturesAll[*immutable, *mut mutable, *move moved, copied]() => {
    // ...
};
```

The capture list `[...]` is often implicit (compiler infers captures).

### 3.2 Variables and Mutability

```tuff
let x = 5;         // immutable
let mut y = 10;     // mutable
y = 20;             // ok
x = 20;             // compile error
```

- **Immutable by default**.
- **Shadowing** allowed within and across blocks:
  ```tuff
  let x = 5;
  { let x = 10; } // x is still 5 here
  let x = "hello"; // shadows outer x
  ```

**Destructuring:**

```tuff
let { x, y } = myPoint;
let (a, b) = myTuple;
let { member0, member1 } = grandparent::parent::Child;
```

### 3.3 Control Flow

All control flow constructs are **expressions** and return values.

**If/Else** (parentheses required):

```tuff
let max = if (a > b) { a } else { b };
```

**Match** (exhaustive):

```tuff
match (myOption) {
    case Some<I32> { field } => field;
    case None<I32> => 100;
}
```

**Type narrowing with `is`:**

```tuff
if (value is Some<T>) {
    // value is narrowed to Some<T> in this block
}
```

**For loop** (generator-based):

```tuff
for (item in 1..5) {  // 1, 2, 3, 4
    // ...
}
```

A generator is of type `() => (Bool, T)`, where `Bool` indicates whether `T` is present.

**Ranges:**

- `1..5` — exclusive (1, 2, 3, 4)
- `1..=5` — inclusive (1, 2, 3, 4, 5)

**While:**

```tuff
while (condition) { /* ... */ }
```

**Loop** (infinite, breakable):

```tuff
let result = loop {
    if (done) { break value; }
};
```

All `break` statements in a `loop` used as an expression must provide a value.

**Early exit**: `return`, `break`, `continue` — no labeled blocks.

### 3.4 Generics

Angle-bracket syntax with contract bounds. **Monomorphized** (each type parameter permutation generates specialized code).

```tuff
fn pass<T>(value : T) => value;

struct Wrapper<T> { field : T; }

fn equalsTo<T : Equatable>(first : T, second : T) => first.equalsTo(second);
```

No `where` clauses — bounds are inline only: `<T : Contract>`.

### 3.5 Contracts (Traits)

Contracts define behavioral interfaces:

```tuff
contract Equals {
    fn equals(*this, other : *This) : Bool;
}
```

- `*this` as receiver parameter.
- `This` refers to the implementing type.
- **Default implementations** supported.
- **No associated types**.
- Contract inheritance: TBD.

**Vtable construction is manual:**

```tuff
let vehicleTable = ~Vehicle<Car> {
    drive : Car::drive
};

let car : Car = Car(/* ... */);
let vehicle : Vehicle = vehicleTable(&move car);
```

Contracts can also be expressed as function pointer types:

```tuff
type Equals<T> = (*T, *T) => Bool;
```

### 3.6 Ownership and Borrowing

Tuff follows **Rust's ownership and borrowing rules**:

- Each value has exactly one owner.
- At any time: **one mutable reference** OR **any number of immutable references** (not both).
- References must not outlive their referent (no dangling references).
- **Move by default** for all non-primitive types.
- **Primitives are copy by default**.
- No built-in `Copy` trait — copying is by convention via `fn copy() : T`.

### 3.7 Lifetime Blocks

Lifetimes are scoped with `lifetime` blocks:

```tuff
lifetime a, b {
    fn add(first : *a I32, second : *b I32) : *a, b I32 => {
        first + second
    }
}
```

- Lifetime parameters are declared in the block header.
- Return types can reference multiple lifetimes: `*a, b T` (lives as long as the shortest of `a` and `b`).

### 3.8 Async/Await (CPS Sugar)

`async` and `await` are syntactic sugar for continuation-passing style:

```tuff
async fn get0() : I32;
async fn get1() : I32;

async fn add() => {
    let result0 = await get0();
    let result1 = await get1();
    result0 + result1
}
```

**Desugars to:**

```tuff
fn get0() : ((I32) => Void) => Void;
fn get1() : ((I32) => Void) => Void;

fn add() : ((I32) => Void) => Void => (consumer : (I32) => Void) => {
    get0()(result0 => {
        get1()(result1 => consumer(result0 + result1));
    });
};
```

The `Promise<T>` type is **not** a real type — the compiler inlines the CPS-transformed type directly.

### 3.9 Module System

Java-like package organization. **Everything is public by default**.

**Imports (destructuring):**

```tuff
let { member0, member1 } = grandparent::parent::Child;
```

Fully-qualified names (FQN) are also supported: `grandparent::parent::Child::member0`.

**No circular dependencies** between modules.

### 3.10 Platform-Specific Code (Expect/Actual)

**Expect declaration** (interface):

```tuff
expect fn get() : I32;
```

**Actual implementation** (must import the expect file, same directory):

```tuff
actual fn get() => 100;
```

- The compiler links expect declarations to actual implementations.
- `Char` size is platform-dependent (e.g., `U8` on native, `U16` on JS targets).

### 3.11 FFI (Foreign Function Interface)

All unsafe/raw operations are performed through FFI to C, C++, or JavaScript.

**Importing external symbols:**

```tuff
let { printf } = extern stdio;
extern fn printf(format : *[U8], ...args : [_; _]) : Void;

printf("%s", "Hello World!");
```

- `extern` declares foreign symbols.
- Variadic FFI functions use `...args : [_; _]`.

### 3.12 Error Handling

Errors use `Result<T, X>` with the tryable union operator:

```tuff
struct Ok<T> { value : T; }
struct Err<X> { error : X; }
type Result<T, X> = Ok<T> |> Err<X>;
```

The `?` operator early-returns the right side of `|>`:

```tuff
fn doWork() : Result<I32, MyError> => {
    let value = riskyOperation()?; // early-returns Err if error
    Ok { value: value + 1 }
};
```

### 3.13 Pattern Matching

```tuff
match (value) {
    case Some<I32> { value } => value;
    case None<I32> => 0;
    case _ => -1; // wildcard
}
```

- **Exhaustive** — all cases must be covered.
- **Destructuring** in case patterns.
- **Wildcard** `_` for catch-all and discard.

---

## 4. Operators

### 4.1 Arithmetic

`+`, `-`, `*`, `/`, `%`

### 4.2 Comparison

`==`, `!=`, `<`, `>`, `<=`, `>=`

### 4.3 Logical

`&&`, `||`, `!`

### 4.4 Bitwise

`&`, `|`, `^`, `<<`, `>>`

### 4.5 Assignment

`=`, `+=`, `-=`, `*=`, `/=`, `%=`

### 4.6 Range

`..` (exclusive), `..=` (inclusive)

### 4.7 Other

- `?` — early return on tryable union error
- `*` — pointer dereference
- `&` — borrow / convert to slice
- `_` — wildcard / discard pattern
- `::` — path separator
- `.` — field access / method call (auto-dereferences)

**No operator overloading.**

---

## 5. Literals

| Literal           | Syntax            | Type      |
| ----------------- | ----------------- | --------- |
| Decimal integer   | `42`, `1_000_000` | Inferred  |
| Hex integer       | `0xFF`            | Inferred  |
| Binary integer    | `0b1010`          | Inferred  |
| Octal integer     | `0o77`            | Inferred  |
| Float             | `3.14`            | Inferred  |
| Boolean           | `true`, `false`   | `Bool`    |
| Character         | `'c'`             | `Char`    |
| String            | `"hello"`         | `*[Char]` |
| Multi-line string | ` ``` ` delimited | `*[Char]` |
| Array             | `[init_fn; N]`    | `[T; N]`  |

Underscore separators are allowed in numeric literals.

---

## 6. Comments

```tuff
// Single-line comment

/* Multi-line
   comment */
```

---

## 7. Naming Conventions

TypeScript conventions:

- **Types**: `PascalCase` (e.g., `Point`, `Option`, `MyContract`)
- **Functions/methods**: `camelCase` (e.g., `getName`, `computeLength`)
- **Variables**: `camelCase` (e.g., `myValue`, `itemCount`)

---

## 8. Compiler: Tuffc

### 8.1 Architecture

**Compilation pipeline:**

```
Source (.tuff) → Lexer → Parser → Type Checker → Borrow Checker → Code Generator → Output
```

### 8.2 Error Handling

- **Collect and report multiple errors** — the compiler does not stop at the first error.
- Whole-program type checking.
- Circular dependencies between modules are **not allowed** (compile error).

### 8.3 Compilation Targets

| Target     | Output    | Status  |
| ---------- | --------- | ------- |
| LLVM       | LLVM IR   | Planned |
| JavaScript | JS source | Planned |

Specific LLVM version and JS module format: TBD (see Open Questions).

### 8.4 Stage 0: Bootstrap Compiler

The bootstrap compiler is written in **TypeScript** and outputs **JavaScript**.

**Supported features (minimum viable subset):**

| Feature           | Included |
| ----------------- | -------- |
| Functions         | Yes      |
| Structs           | Yes      |
| Generics          | Yes      |
| Match expressions | No       |
| Contracts         | No       |
| Borrow checking   | No       |
| Lifetime blocks   | No       |
| Refinement types  | No       |
| Async/await       | No       |
| Expect/actual     | No       |

The borrow checker is skipped in Stage 0 because JavaScript is garbage-collected.

### 8.5 Self-Hosting Path

1. **Stage 0**: TypeScript compiler → compiles Tuff subset → outputs JavaScript.
2. **Stage 1**: Rewrite the compiler in Tuff → compile with Stage 0 → produce a Tuff-compiled JS compiler.
3. **Stage 2**: Use Stage 1 compiler to compile itself → verify output matches.

### 8.6 Testing Strategy

End-to-end tests: complete Tuff programs are compiled and their output is verified against expected results.

---

## 9. Non-Functional Requirements

- **Correctness**: The compiler must reject all programs that violate ownership, borrowing, or lifetime rules (in stages that support borrow checking).
- **Error quality**: Collect and report multiple errors per compilation, with source location information.
- **Determinism**: Given the same input, the compiler must always produce the same output.

Performance, scalability, and availability requirements are not yet specified (single-user compiler tool).

---

## 10. Constraints and Assumptions

### 10.1 Constraints

- No `unsafe` keyword or escape hatch — all unsafe operations are performed via FFI.
- **No panics** — all potentially-failing operations (indexing, arithmetic, division) require compile-time proof of safety via refinement types.
- No operator overloading.
- No implicit type conversions (except safe numeric widening where target range contains source range).
- No wrapping arithmetic — overflow is always a compile error without refinement proof.
- No `const` / compile-time evaluation.
- No macros, attributes, or reflection (deferred to future specification).
- No labeled blocks.
- Positional function arguments only.
- Generics constraints only via inline bounds `<T : Contract>` — no `where` clauses.

### 10.2 Assumptions

- The TypeScript bootstrap compiler targets a Node.js runtime for execution.
- The borrow checker rules are identical to Rust's (one mutable XOR many immutable references, no dangling references).
- Monomorphization is the only generic instantiation strategy.

---

## 11. Acceptance Criteria

1. The Stage 0 compiler (TypeScript) can parse, type-check, and generate JavaScript for programs using functions, structs, and generics.
2. End-to-end tests pass: Tuff source → compile → execute JS → correct output.
3. The compiler reports multiple errors per compilation rather than stopping at the first.
4. No `unsafe` keyword is accepted by the parser.
5. Struct literal syntax works for explicitly-defined structs; constructor functions with `this` work for implicitly-defined structs.

---

## 12. Open Questions

| #   | Question                                                                                                     | Area             |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | How will refinement types be verified at compile time? (SMT solver, abstract interpretation, manual proofs?) | Refinement Types |
| 2   | What LLVM version will be targeted? LLVM IR text, bitcode, or C API?                                         | Compiler Backend |
| 3   | What JS module format will be output? (ES modules, CommonJS, browser scripts?)                               | Compiler Backend |
| 4   | What JS runtime features are assumed for the compilation target?                                             | Compiler Backend |
| 5   | How does contract inheritance work? Is it supported?                                                         | Contracts        |
| 6   | What is the complete list of reserved keywords?                                                              | Syntax           |
| 7   | How does type casting between numeric types work? (`as` keyword?)                                            | Type System      |
| 8   | What are the specifics of monomorphization code bloat mitigation?                                            | Generics         |
| 9   | What is the standard library scope?                                                                          | Standard Library |
| 10  | Are macros, attributes, annotations, or reflection planned?                                                  | Future Features  |
