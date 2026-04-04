# Spec 9: Arrays

## Objective

Add array support to Tuff with the following scope:

- Array literals with JS-like syntax: `[expr, expr, ...]`
- Empty arrays: `[]`
- Index access expressions: `arr[indexExpr]`
- Assignment targets:
  - `let arr = [..];`
  - `arr = [..];`
  - `arr[indexExpr] = valueExpr;`
- Array expressions valid as full program entry expressions

## User Stories

- As a Tuff author, I want to create arrays inline so I can represent ordered collections.
- As a Tuff author, I want to read array elements with bracket indexing so I can retrieve values dynamically.
- As a Tuff author, I want to reassign arrays and set individual elements so I can mutate state in control flow.
- As a Tuff author, I want nested arrays and expression indices so I can compose more advanced data access.
- As a Tuff author, I want malformed array syntax rejected at compile time.

## Semantics

- Conditions (`if`, `while`) use JS truthiness, so arrays are truthy.
- Out-of-bounds and negative index behavior follows JS (`undefined` unless property exists).
- Trailing commas in array literals are rejected in this iteration.
- Array methods are out of scope for this iteration beyond existing generic call/member behavior.
