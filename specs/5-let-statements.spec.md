# Let Statements and Mutable Bindings

Extends the earlier numeric and arithmetic specifications with sequential
statements, mutable bindings, and assignment.

## User stories

- As a caller, I want to bind values with `let` so I can name intermediate
  results in Tuff programs.
- As a caller, I want `let mut` bindings and reassignment so I can update a
  value over time.
- As a caller, I want bindings to be usable in later statements so I can write
  simple sequential programs.
- As a caller, I want typed or inferred bindings to reject invalid assignments
  so numeric values remain safe.
- As a caller, I want using a variable before it is initialized to fail clearly
  so uninitialized reads do not silently succeed.

## Scope

- `let` statements are supported at the statement level.
- Programs may contain multiple statements separated by semicolons.
- Bindings are immutable by default.
- `let mut` bindings are mutable and may be assigned with `name = expr`.
- A binding may declare a type, infer its type from an initializer, or do both.
- If a binding has no initializer, it must have a type annotation.
- Initializers and assignments must fit the binding's declared or inferred
  numeric type.
- Redeclaring the same name later in a sequence is allowed and shadows earlier
  bindings.
- Reading a variable before it has been initialized is an error.
- `let` statements are not expression-level constructs.
