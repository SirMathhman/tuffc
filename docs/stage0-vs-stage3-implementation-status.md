# Stage0 vs Stage3 Implementation Status (2026-02-17)

This note records current feature parity status between:

- **Stage0**: TypeScript compiler in `src/main/js/*`
- **Stage3**: selfhost compiler JS artifact produced from `src/main/tuff/selfhost.tuff` via Stage2

## Summary

Stage3 now has strong parity with Stage0 for core compiler functionality, destructor/drop semantics, and canonical `into` expression/value forms used in the current parity suite.

## Implemented in both Stage0 and Stage3

- Core pass pipeline and JS codegen
- Module graph imports and module diagnostics (`E_MODULE_*`)
- Resolver shadowing checks (`E_RESOLVE_SHADOWING`)
- Borrow checker core move semantics (`E_BORROW_USE_AFTER_MOVE`, borrow conflicts)
- Copy semantics checks (copy structs/enums/copy aliases)
- Strict safety checks (nullable pointer guard, div/mod-by-zero, overflow)
- Match exhaustiveness checking
- Contract declarations and `into` **statement** semantics
- Canonical `into` expression/value forms:
  - `value.into<Contract>(...)`
  - `value.into<Contract>`
- Structured diagnostics contract (`source`, `cause`, `reason`, `fix`)
- Destructor alias syntax in parser: `type Alias = Base then destructorFn;`
- `*move` pointer qualifier parsing/type naming
- Destructor declaration/signature validation (`E_TYPE_DESTRUCTOR_NOT_FOUND`, `E_TYPE_DESTRUCTOR_SIGNATURE`)
- Explicit `drop(...)` handling across resolver/typecheck/borrowcheck
- Drop lifecycle diagnostics parity cases (`E_BORROW_DOUBLE_DROP`, `E_BORROW_USE_AFTER_DROP`, `E_BORROW_INVALID_TARGET`)
- Drop arity diagnostics parity (`drop()`, `drop(a, b)`)

## Implemented in Stage0 but missing/incomplete in Stage3

- No major Stage0-only gaps are currently tracked in this note after recent parity work.

## Partially aligned / follow-up candidates

- Some destructor/drop edge paths may still differ in **phase precedence** (which pass reports first) for specially crafted programs.
- Canonical `into` dynamic dispatch should receive broader runtime parity expansion (especially across richer object/constructor patterns) beyond current targeted parity coverage.
- Broader runtime parity for implicit destructor invocation ordering (beyond existing Stage0-focused runtime tests) can be expanded for selfhost-specific coverage.

## Expected follow-up work for Stage3

1. Add broader selfhost runtime parity tests for canonical `into` dynamic dispatch across richer constructor/object patterns.
2. Add broader selfhost parity/runtime tests for implicit destructor invocation ordering across nested scopes/branches.
3. Continue tightening exact diagnostic-code parity on rare phase-order edge cases.
