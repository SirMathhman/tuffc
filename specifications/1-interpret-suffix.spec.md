# interpretTuff suffix parsing

## Goal

Interpret Tuff numeric literals with an optional uppercase type suffix and report invalid inputs as errors.

## User stories

- As a caller, I want `interpretTuff("100U8")` to return `100` so that I can read typed numeric literals.
- As a caller, I want empty input to still return `0` so that the previous special case remains supported.
- As a caller, I want invalid input and unsupported forms to return an error so that bad literals are rejected clearly.
