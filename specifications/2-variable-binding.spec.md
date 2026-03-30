# Iteration 2 - Variable binding pipeline

## Objective

Add support for typed variable declarations so test programs can store and reuse values computed from literals and `read<T>()` calls.

## User stories

- As a language implementer, I want `let name : Type = expr; name` to bind and retrieve a variable value, so I can test variable storage semantics.
- As a language implementer, I want type assignability checking, so expr type must be assignable to the annotated Type (e.g., `U8` expr assignable to `U16` type).
- As a language implementer, I want variable shadowing to work, so inner `let` can rebind outer names.
- As a language implementer, I want chained bindings, so `let x : U8 = 10U8; let y : U16 = read<U16>(); y` can compose logic.

## Type assignability rules

- `Ux` is assignable to `Uy` if `x <= y` (smaller unsigned fits in larger unsigned).
- `Ix` is assignable to `Iy` if `x <= y` (smaller signed fits in larger signed).
- `Ux` is NOT assignable to `Iy` (unsigned to signed is unsafe).
- `Ix` is NOT assignable to `Uy` (signed to unsigned is unsafe).

## Scope notes

- `expr` can be: typed literals, `read<T>()`, or variable references.
- Final expression must be a valid term (literal, read, or variable name).
- Shadowing is allowed; inner rebinds outer.
- Out-of-scope variable references fail at compile time.
