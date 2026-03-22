# Read U8 From Stdin

## User story

As a caller, I want compiling and executing `read<U8>()` with stdin `100` to return `100` so the compiler can support a basic input-driven program.

## Scope

- The public `compileTuffAndExecute` API should accept a second `stdIn` argument.
- The `read<U8>()` source should use that stdin value when executed.
- The observed result should be the numeric value `100`.
