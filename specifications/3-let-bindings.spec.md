# interpretTuff let bindings

## Goal
Interpret flat sequences of `let` bindings and expressions so variable bindings can be reused later in the same input.

## User stories
- As a caller, I want `interpretTuff("let x : U8 = 1U8 + 2U8; x")` to return `3` so that I can bind and reuse values.
- As a caller, I want type annotations on `let` bindings to be validated when present so that mismatched typed literals are rejected.
- As a caller, I want invalid statements, unknown variables, and malformed sequences to return an error so that bad input is rejected clearly.
