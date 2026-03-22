# Empty Program Exit Code

## User story

As a caller, I want compiling and executing an empty Tuff program to return exit code `0` so the compiler API has a stable baseline behavior.

## Scope

- The public `compileTuffAndExecute` API should accept an empty source string.
- The observed result should be the numeric exit code `0`.
