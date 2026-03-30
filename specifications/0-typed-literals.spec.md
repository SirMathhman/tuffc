# Iteration 0 - Typed literals pipeline

## Objective

Introduce a minimal, explicit compilation path for typed integer literals so the current stub pipeline can evaluate a literal program and return a concrete numeric value.

## User stories

- As a language implementer, I want a Tuff literal like `100U8` to compile through the test pipeline and evaluate to `100`, so that we can verify end-to-end compiler plumbing before full language design is complete.
- As a compiler user, I want invalid typed literals to fail at compile time, so that errors are surfaced early and never deferred to generated runtime code.
- As a compiler user, I want out-of-range typed literals to fail at compile time, so that generated JavaScript cannot silently produce wrong values.

## Scope notes

- Supported suffix families for this iteration are unsigned (`U8`, `U16`, `U32`, `U64`) and signed (`I8`, `I16`, `I32`, `I64`) integer literals.
- Full Tuff grammar remains TBD; this iteration only formalizes a literal-only compile path.
