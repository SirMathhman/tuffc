# interpretTuff Bool values

## Goal

Interpret `Bool` values with `true` and `false` literals, boolean operators, and Bool-aware bindings while preserving the existing public `interpretTuff` return type by mapping final booleans to `1` and `0`.

## User stories

- As a caller, I want `interpretTuff("true")` to return `1` and `interpretTuff("false")` to return `0` so that Bool results are observable through the current API.
- As a caller, I want `Bool` annotations, Bool inference, and Bool variable references to work in `let` bindings so that I can bind and reuse boolean values.
- As a caller, I want `!`, `&&`, and `||` to work with standard precedence (`!` before `&&` before `||`) so that boolean expressions evaluate predictably.
- As a caller, I want mutable Bool bindings to support reassignment under the same mutability rules as numeric bindings so that booleans participate consistently in the language.
- As a caller, I want mixed numeric/boolean operations, invalid Bool annotations, and use of reserved Bool keywords as identifiers to return an error so that the type system remains explicit and predictable.
