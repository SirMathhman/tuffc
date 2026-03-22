# U8 Literal Result

## User story

As a caller, I want compiling and executing `100U8` to return `100` so the compiler can handle a basic unsigned numeric literal.

## Scope

- The public `compileTuffAndExecute` API should accept the `100U8` source string.
- The observed result should be the numeric value `100`.