# interpretTuff arithmetic parsing

## Goal

Interpret Tuff expressions containing typed numeric literals, arithmetic operators, and parentheses.

## User stories

- As a caller, I want `interpretTuff("1U8 + 2U8")` to return `3` so that simple arithmetic expressions work.
- As a caller, I want operator precedence and parentheses to be respected so that grouped expressions evaluate correctly.
- As a caller, I want malformed expressions and arithmetic errors to return an error so that invalid input is rejected clearly.
