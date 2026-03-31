# Iteration 3 — Mutable Binding

## Objective
Add mutable variable declarations and reassignment support to the Tuff pipeline form:

`let mut name : Type = expr; name = expr; name`

## Scope
- Support mutable declaration syntax: `let mut <name> : <Type> = <expr>`
- Preserve immutable declaration syntax: `let <name> : <Type> = <expr>`
- Support reassignment syntax: `<name> = <expr>`
- Reassignment must be valid only when `<name>` is mutable
- Type safety for reassignment follows the same assignability rules as declaration
- `let` always introduces a new binding and can shadow previous bindings
- Final expression resolves to the latest visible binding

## Non-goals
- No expression language expansion beyond current supported expression forms
- No block-scope language features beyond current sequential pipeline semantics
- No changes to integer type families or read semantics

## Acceptance Intent
- Mutable declarations can be reassigned successfully
- Immutable declarations reject reassignment
- Invalid reassignment type relationships are rejected
- Shadowing remains supported and deterministic
