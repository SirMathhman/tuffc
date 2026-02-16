# Tuff Spec Gap Report

_Last updated: 2026-02-16 (from `npm run semantics:exhaustive`)_

This document lists the current gaps between the implemented compiler behavior and `SPECIFICATION.md`, based on the failing exhaustive semantics audit in `src/test/js/spec-semantics-exhaustive.ts`.

## Summary

- Exhaustive semantics audit: **failing**
- Gap pattern: mostly **parsing/feature support gaps** and a few **diagnostic code naming mismatches**
- Stage impact: most feature gaps fail consistently on Stage0/1/2/3 (with Stage2/3 often surfacing `E_SELFHOST_PANIC`)

## A) Missing or incomplete language feature support

These are spec-described constructs that currently fail to compile.

### ✅ Resolved: Generic call/type argument usage mismatch

- Spec area: `2.1`, `3.2`
- Case: `functions:generic-identity`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added generic call suffix parsing (`callee<T>(...)`) in Stage0 parser.
  - Mirrored parser behavior in selfhost parser for stage alignment.

### ✅ Resolved: Closure/lambda expression parsing

- Spec area: `3.3`
- Case: `closures:arrow-lambda`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added parser support for function types (`() => T`, `(A) => B`).
  - Added expression support for `() => ...` lambdas and `fn ... => ...` function expressions.
  - Added function-value equivalence audit cases:
    - `let func : () => I32 = get;`
    - `let func : () => I32 = fn get() : I32 => 100;`
    - `let func : () => I32 = () => 100;`
    - `let func = () => 100;`
  - Mirrored parser support in selfhost parser for stage alignment.

### ✅ Resolved: `object` singleton declarations

- Spec area: `2.1`, `3.4`
- Case: `objects:singleton-generic`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added parser support for `object Name<T> {}` declarations in Stage0 and selfhost parsers.
  - Wired object declarations into resolver/module declaration collection.
  - Added nominal object typing and JS/selfhost codegen singleton emission so `Name<T>` use-sites compile.

### ✅ Resolved: `loop {}` construct

- Spec area: `3.6`
- Case: `loops:for-while-loop`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added Stage0 parser support for `loop { ... }` as `LoopStmt`.
  - Mirrored loop statement parsing in selfhost parser.
  - Wired `LoopStmt` through resolver/typecheck/borrowcheck and JS/C codegen in Stage0 and selfhost.

### 3) `async fn` syntax/CPS surface

- Spec area: `3.7`, `9.4`
- Case: `async:syntax-cps`
- Observed:
  - Stage0/1: `E_PARSE_UNEXPECTED_TOKEN` (`keyword:async`)
  - Stage2/3: `E_SELFHOST_PANIC` (`Unexpected token in expression`)

### ✅ Resolved: `contract` keyword (static syntax surface)

- Spec area: `2.2`
- Case: `contracts:definition-and-impl`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added parser support for `contract Name { fn ...; }` declarations in Stage0 and selfhost.
  - Added support for constructor-local `into Contract;` statements in Stage0 and selfhost.
  - Added resolver/typecheck plumbing so unknown contracts in `into` statements are diagnosed.
  - Current implementation is static-syntax/conformance plumbing only; dynamic dispatch/table generation remains intentionally out-of-scope.

### 5) `class fn ...` desugar behavior mismatch

- Spec area: `3.4`
- Case: `class:syntax-desugar`
- Observed:
  - Stage0/1: `E_RESOLVE_SHADOWING` (name collision on `Car`)

### ✅ Resolved: `expect` / `actual` declarations

- Spec area: `5.2`
- Case: `platform:expect-actual`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added parser support for `expect fn ...;` and `actual fn ... => ...` in Stage0 and selfhost parsers.
  - Added resolver enforcement for exact one-to-one expect/actual pairing with exact signature match.
  - Updated typecheck/codegen behavior to skip emitting `expect` declarations and emit only runtime `actual` implementations.
  - Implemented `expect`/`actual` as contextual modifiers (not globally reserved keywords) to avoid breaking existing identifiers.

### ✅ Resolved: Result union marker `|>` + unwrap ergonomics in tested form

- Spec area: `2.1`, `4.7`
- Cases: `result:pipe-union-and-q`, `result:unwrap-call-postfix`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added generic struct initializer parsing in expressions (e.g. `Ok<I32> { value: v }`) in Stage0 and selfhost parsers.
  - Moved unwrap parsing to true postfix handling so Rust-like forms such as `doSomething()?` are parsed with correct precedence.

### 8) Dependent array signature form (`L : USize`, `_` placeholder in tested shape)

- Spec area: `2.1`, `2.4`, `4.3`
- Case: `arrays:dependent-shape`
- Observed:
  - Stage0/1: `E_RESOLVE_UNKNOWN_IDENTIFIER` (`Unknown identifier 'toStackArray'`)
  - Stage2/3: `E_RESOLVE_UNKNOWN_IDENTIFIER` (`Unknown identifier: toStackArray`)

## B) Diagnostic contract/code alignment gaps

These cases fail for code-name mismatch rather than semantic pass/fail behavior.

### 1) Overflow strict-safety diagnostic code

- Spec area: `4.2`, `9.2`
- Case: `reject:overflow-strict`
- Expected in test: `E_SAFETY_INTEGER_OVERFLOW` (or selfhost panic)
- Actual stage1/2/3: `E_SAFETY_OVERFLOW`
- Gap type: **diagnostic code naming mismatch**

### 2) Non-exhaustive match diagnostic code

- Spec area: `3.5`, `9.1`
- Case: `reject:non-exhaustive-match`
- Expected in test: `E_TYPE_MATCH_NON_EXHAUSTIVE` (or selfhost panic)
- Actual stage1/2/3: `E_MATCH_NON_EXHAUSTIVE`
- Gap type: **diagnostic code naming mismatch**

## C) Cross-stage behavior notes

- Unsupported syntax/features generally fail similarly across stages.
- Stage2/Stage3 often collapse parser/resolver/type errors into `E_SELFHOST_PANIC`, reducing diagnostic specificity versus Stage0/Stage1.

## D) Priority suggestions

1. **Parser surface parity first**: `async`.
2. **Type-system syntax/parsing fixes**: generic call forms and dependent array signatures.
3. **Desugar/resolve collision handling**: `class fn` shadowing behavior.
4. **Diagnostic harmonization**: align expected-vs-actual codes for overflow and match exhaustiveness.

## E) Related non-spec test pipeline issue (separate)

From `npm test`, there is also an unrelated blocker before exhaustive audit execution in that sequence:

- `src/test/js/selfhost-test.ts:30:2` transform error (`Unexpected ']'`).

This is a test file syntax issue, not a language-spec gap, but it currently blocks full pipeline completion.
