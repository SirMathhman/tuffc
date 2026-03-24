# interpretTuff mutable assignments

## Goal

Interpret mutable `let` bindings and simple reassignment statements so callers can update a previously declared mutable variable before evaluating the final expression.

## User stories

- As a caller, I want `interpretTuff("let mut x = 0U8; x = 1U8 + 2U8; x")` to return `3` so that I can update a mutable binding and use the new value later.
- As a caller, I want reassignment targets to be limited to simple identifiers for this iteration so that assignment syntax stays narrow and predictable.
- As a caller, I want reassigning an immutable binding such as `interpretTuff("let x = 0U8; x = 1U8; x")` to return an error so that mutability is enforced.
- As a caller, I want malformed reassignment statements and unknown reassignment targets to return an error so that invalid input is rejected clearly.
