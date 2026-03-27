# Specification: Result-based interpretTuff contract

## Objective

Provide a structured return type for `interpretTuff` so callers can reliably inspect success, parsed value, and descriptive error reason.

## User stories

- As a toolchain developer, I want `interpretTuff` to return a `Result` struct so that I can distinguish success from failure without magic integers.
- As a caller, I want `interpretTuff("100U8")` to report success with value `100` so that valid U8 literals are interpreted correctly.
- As a caller, I want invalid inputs to return `ok=0` and a descriptive static error string so that error handling is explicit and cheap.
- As a caller, I want the accepted literal format to be decimal digits followed by exact uppercase `U8` so that parsing behavior is predictable.
- As a maintainer, I want the interface to use static error messages so that there is no dynamic allocation burden on callers.

## Non-goals

- Supporting lowercase suffixes or additional numeric formats.
- Returning dynamically allocated error messages.
- Implementing full language interpretation beyond this literal parsing behavior.
