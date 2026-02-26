# Lifetime System Sanity Check Audit Report

**Date:** 2026-02-26
**Category:** `lifetime-sanity`
**Tests:** 13 cases
**Status:** 8/13 passed (62%)

---

## Summary

The Tuff lifetime system exists **syntactically but NOT semantically**. While `lifetime` blocks parse and type representations support lifetime annotations (e.g., `*a Str`), the borrowchecker does **not enforce** lifetime constraints. This results in 5 test failures where code that should be rejected compiles successfully.

---

## Test Results

| ID | Test Name | Expected | Actual | Gap |
|----|-----------|----------|--------|-----|
| db:142 | valid-basic-window-use | ✓ compile | ✓ compile | - |
| db:143 | invalid-window-escape-no-copy | ✗ compile error | ✓ compile | **Lifetime escape not enforced** |
| db:144 | valid-escape-via-copy | ✓ compile | ✓ compile | - |
| db:145 | valid-multiple-overlapping-windows | ✓ compile | ✓ compile | - |
| db:146 | valid-empty-window | ✓ compile | ✓ compile | - |
| db:147 | invalid-window-out-of-bounds-start | ✗ compile error | ✓ compile | **Refinement constraints not enforced** |
| db:148 | invalid-window-end-before-start | ✗ compile error | ✓ compile | **Refinement constraints not enforced** |
| db:149 | valid-window-in-closure | ✓ compile | ✓ compile | - |
| db:150 | invalid-return-window-from-closure | ✗ compile error | ✓ compile | **Lifetime escape not enforced** |
| db:151 | valid-window-chaining | ✓ compile | ✓ compile | - |
| db:152 | invalid-use-after-source-move | ✗ compile error | ✓ compile | **Lifetime escape not enforced** |
| db:153 | valid-window-after-copy | ✓ compile | ✓ compile | - |
| db:154 | valid-window-in-struct | ✓ compile | ✓ compile | - |

**Passed:** 8
**Failed:** 5

---

## Identified Gaps

### 1. No Lifetime Escape Checking

**Tests:** db:143, db:150, db:152

**Issue:** The borrowchecker does not track lifetime relationships between a value and its references. When a `*t Str` window is created from a source string `s`, the compiler does not enforce that the window cannot outlive `s` or be used after `s` is moved.

**Example (db:143):**
```tuff
fn make_window() : *Str => {
  let s = "hello";
  s.str_slice_window(0, 3)  // Should fail: window escapes source scope
}
```

**Expected:** `E_BORROW_LIFETIME_ESCAPE` (or similar)
**Actual:** Compiles successfully

**Current Borrowchecker Support:**
- `E_BORROW_USE_AFTER_MOVE` - detects use of moved values
- `E_BORROW_MOVE_WHILE_BORROWED` - detects moving while borrowed
- `E_BORROW_MUT_CONFLICT` - detects conflicting mutable borrows
- `E_BORROW_IMMUT_WHILE_MUT` - detects immutable borrow during mutable borrow
- **Missing:** Lifetime escape checking

### 2. No Refinement Type Constraint Enforcement

**Tests:** db:147, db:148

**Issue:** Refinement types like `StrIndex(this) = USize < str_length(this)` and constraints like `start: StrIndex(this) <= end` are parsed and stored in the AST but are **not evaluated** at compile time.

**Example (db:147):**
```tuff
type StrIndex(this: *Str) = USize < str_length(this);
fn main() => {
  let s = "hi";
  let w = s.str_slice_window(5, 10);  // Should fail: 5 >= str_length("hi") = 2
}
```

**Expected:** `E_TYPE_REFINEMENT_VIOLATION`
**Actual:** Compiles successfully (runtime clamps bounds instead)

**Current Status:**
- Parser: Parses refinement type syntax
- Typechecker: Stores refinement constraints in AST
- Borrowchecker: Ignores constraints entirely
- Runtime: Bounds checking happens at runtime (clamping)

---

## Current Lifetime System Architecture

### What Works (Implemented)

1. **Parser/Resolver:**
   - Parses `lifetime { ... }` blocks
   - Tracks lifetime names in `resolve_lifetime_scopes` stack
   - Detects duplicate lifetime names: `E_RESOLVE_DUPLICATE_LIFETIME`

2. **Typechecker:**
   - Type representations support lifetime annotations (e.g., `*a Str`)
   - Stores lifetime index in `NK_POINTER_TYPE.data4`
   - Parses dependent refinement types like `USize < str_length(this)`

3. **Codegen:**
   - Erases lifetime annotations during code generation (lifetimes are compile-time only)
   - JS and C backends correctly emit code

4. **Borrowchecker:**
   - Tracks move semantics at the value level
   - Detects use-after-move with `E_BORROW_USE_AFTER_MOVE`
   - Enforces borrow exclusion (mut XOR immut)

### What Doesn't Work (Missing)

1. **Borrowchecker:**
   - **No lifetime relationship tracking** — does not know that `*t Str` binds to source `s`
   - **No escape analysis** — allows returning `*t Str` from functions where `t` is local
   - **No lifetime-bound move checking** — allows using `*t Str` after source is moved

2. **Typechecker:**
   - **No refinement constraint evaluation** — constraints are stored but never checked
   - **No dependent type verification** — `start <= end` is a syntactic sugar, not a proof

---

## Root Cause Analysis

The lifetime system was designed with **Rust-like semantics** but only implemented partially:

| Feature | Rust | Tuff Current |
|---------|------|--------------|
| Syntax | `fn foo<'a>(x: &'a str) -> &'a str` | `lifetime a { fn foo(x: *a Str) : *a Str }` |
| Parsing | ✓ | ✓ |
| Typechecking | ✓ (lifetimes in type signature) | ✓ (lifetimes in AST) |
| Borrowchecker | ✓ (lifetime variance, escape analysis) | ✗ (no lifetime tracking) |
| Refinement | N/A | ✓ (syntax only) |
| Constraint Solving | N/A | ✗ (constraints not evaluated) |

The borrowchecker (`borrowcheck_impl.tuff`) operates on a **value-based move/borrow model**:
- Tracks which values have been moved
- Tracks active borrows (mut vs immut)
- Detects conflicts

But it has **no concept of lifetime hierarchies**:
- Doesn't know that `*t Str` refers to `s`
- Doesn't know when `t` ends (scope analysis not implemented)
- Doesn't prevent `*t Str` from escaping `t`'s scope

---

## Recommendations

### Short-Term (Bug Fix Level)

1. **Update Test Expectations:**
   - Change db:143, db:147, db:148, db:150, db:152 from `expectsCompileError: 1` to `0`
   - Update expected diagnostic codes to empty strings
   - Document that these are known gaps

2. **Add Documentation:**
   - Update `SPECIFICATION.md` to clarify that lifetime enforcement is **not yet implemented**
   - Add a "Lifetime System Status" section to `GAPS.md`

### Medium-Term (Feature Implementation)

3. **Implement Lifetime Escape Analysis:**
   - Extend borrowchecker state to track lifetime-variable bindings
   - Add `bc_enter_lifetime(lifetime_name, source_expr)` / `bc_exit_lifetime(lifetime_name)`
   - Add `bc_check_return_type(expr_type, fn_return_type)` to prevent escape
   - Emit new error code: `E_LIFETIME_ESCAPE`

4. **Implement Refinement Constraint Checking:**
   - Add a constraint evaluator to typechecker
   - For `start <= end`, verify at call site using refinement substitution
   - For `USize < str_length(this)`, verify using string literal length or known bounds
   - Emit new error code: `E_TYPE_REFINEMENT_VIOLATION`

### Long-Term (System Design)

5. **Lifetime Polymorphism:**
   - Support lifetime subtyping (`'a: 'b` for outlives relationships)
   - Variance checking for generic types
   - Lifetime elision rules

6. **Dependent Types:**
   - Full constraint solving system
   - Proof-carrying code generation
   - Runtime verification certificates

---

## Impact Assessment

### Safe to Use?

**Yes**, but with caveats:

1. **`str_slice_window` is safe in practice** — The C implementation returns a pointer into the source buffer, and the JS implementation is copy-based. No UB occurs because:
   - In JS: Everything is garbage-collected; no dangling pointers
   - In C: The window pointer is valid as long as the source string is alive (which is true for all current usage patterns in selfhost)

2. **But not provably safe by the compiler** — The compiler currently does not prevent you from writing:
   ```tuff
   fn escape() : *Str {
     let s = "hello";
     s.str_slice_window(0, 3)  // Compiles but would be UB in C if s were deallocated
   }
   ```

3. **Selfhost code is correct by convention** — All current usage patterns keep windows within their source scope, but this is not enforced.

### When Will This Become Critical?

- **C backend freestanding mode** — When Tuff programs can deallocate strings (via destructors or explicit free), lifetime enforcement becomes a safety property, not just a best practice.
- **FFI interop** — When passing windows to external C code, escape analysis prevents passing dangling pointers.
- **Zero-copy optimization** — The whole point of `str_slice_window` is zero-copy; without enforcement, it's a footgun.

---

## Related Work

- [SPECIFICATION.md §2.3 Lifetimes and Ownership](../SPECIFICATION.md#23-lifetimes-and-ownership)
- [GAPS.md](../GAPS.md) — Feature gap tracking
- [borrowcheck_impl.tuff](../src/main/tuff/selfhost/internal/borrowcheck_impl.tuff) — Borrowchecker implementation
- [runtime-abi-matrix.md](./runtime-abi-matrix.md) — Runtime ABI for `str_slice_window`

---

## Appendix: Current Error Codes

### Borrowchecker Errors (Implemented)
- `E_BORROW_USE_AFTER_MOVE` — Use of moved value
- `E_BORROW_MOVE_WHILE_BORROWED` — Moving while borrowed
- `E_BORROW_MUT_CONFLICT` — Conflicting mutable borrows
- `E_BORROW_IMMUT_WHILE_MUT` — Immutable borrow during mutable borrow
- `E_BORROW_ASSIGN_WHILE_BORROWED` — Assigning while borrowed
- `E_BORROW_INVALID_COPY_ALIAS` — Copy of non-copy type
- `E_BORROW_DROP_MISSING_DESTRUCTOR` — Type without destructor

### Lifetime Errors (Partially Implemented)
- `E_RESOLVE_DUPLICATE_LIFETIME` — Duplicate lifetime name in block (implemented in resolver)

### Lifetime Errors (Not Yet Implemented)
- `E_LIFETIME_ESCAPE` — Lifetime-qualified value escapes its scope
- `E_LIFETIME_RETURN_VIOLATION` — Returning a value with non-function lifetime

### Typechecker Errors (Partially Implemented)
- `E_TYPE_REFINEMENT_VIOLATION` — Refinement constraint violated (not yet implemented)