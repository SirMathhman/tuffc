# Tuff Spec Gap Report

_Last updated: 2026-02-17 (from `bun run semantics:exhaustive`)_

This document lists the current gaps between the implemented compiler behavior and `SPECIFICATION.md`, based on the failing exhaustive semantics audit in `src/test/js/spec-semantics-exhaustive.ts`.

## Summary

- Exhaustive semantics audit: **failing**
- Gap pattern: mostly **parsing/feature support gaps** and a few **diagnostic code naming mismatches**
- Stage impact: most feature gaps fail consistently on Stage0/1/2/3 (with Stage2/3 previously surfacing generic selfhost internal diagnostics)

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
  - Stage2/3: parser diagnostic (`E_PARSE_UNEXPECTED_TOKEN`, `Unexpected token in expression`)

### ✅ Resolved: `contract` keyword + Stage0 static dispatch checks

- Spec area: `2.2`
- Case: `contracts:definition-and-impl`
- Status: **fixed** (no longer reported by `npm run semantics:exhaustive`)
- Notes:
  - Added parser support for `contract Name { fn ...; }` declarations in Stage0 and selfhost.
  - Added support for constructor-local `into Contract;` statements in Stage0 and selfhost.
  - Added resolver/typecheck plumbing so unknown contracts in `into` statements are diagnosed.
  - Stage0 now enforces generic contract bounds at call sites (`T : Contract`) and validates required contract method implementations for concrete implementers.
  - Added focused Stage0 regressions in `src/test/js/contracts-static-dispatch.ts`.
  - Stage0 now also supports expression-form conversions (`value into Contract(...)`) for dynamic wrappers.
  - Selfhost parity for the new bound/method-conformance checks is still a follow-up task.

### ✅ Resolved: Stage0 dynamic dispatch lowering for `into` contracts

- Spec area: `2.2`
- Status: **implemented in Stage0 runtime/codegen path**
- Notes:
  - Added Stage0 desugaring that synthesizes runtime contract wrapper/table structs (`__dyn_<Contract>`, `__dyn_<Contract>Table`).
  - Added Stage0 lowering for `into Contract;` to generate `into<Contract>()` factory closures when contract methods are declared locally.
  - Canonical conversion call syntax now works in Stage0: `value.into<Contract>(...)` (infix `value into Contract(...)` remains accepted for compatibility).
  - Converter values are now supported in Stage0 via `value.into<Contract>` (e.g., `let convert = myCar.into<Vehicle>; let v = convert(&mut ptr);`).
  - Added constructor-style desugar for `fn TypeName(...) { ... into Contract; }` to synthesize implicit constructor state and return value in Stage0.
  - Added parser/typechecker/borrowchecker support needed by corrected syntax flow: expression `into`, uninitialized `let mut name : Type;`, and pointer qualifiers `*out uninit mut T` (runtime-first semantics, static diagnostics to be tightened).
  - Added JS codegen dynamic method dispatch fallback for method-sugar calls: prefers `receiver.table.method(receiver.ref, ...)` when present, otherwise falls back to static function call.
  - Added resolver/typecheck support for local function declarations in block scope so lowered dynamic factories can reference captured/local methods.
  - Borrow checker enforces move semantics for canonical conversions (both call-form and converter-value form) and reports use-after-move via `E_BORROW_USE_AFTER_MOVE` when a consumed source is reused.
  - Covered by runtime regression in `src/test/js/contracts-static-dispatch.ts` (`v.drive()` through dynamic wrapper returns expected value).
  - Selfhost parser/typecheck/codegen parity for this dynamic path remains pending.

### 5) `class fn ...` desugar behavior mismatch

- Spec area: `3.4`
- Case: `class:syntax-desugar`
- Observed:
  - Stage0/1: `E_GENERIC` (constructor/class return typing mismatch)

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
- Stage2/Stage3 may still emit `E_SELFHOST_INTERNAL_ERROR` for uncovered frontend paths; continue replacing remaining generic paths with specific parse/lex/type/module codes.

## D) Priority suggestions

1. **Parser surface parity first**: `async`.
2. **Type-system syntax/parsing fixes**: generic call forms and dependent array signatures.
3. **Desugar/resolve collision handling**: `class fn` shadowing behavior.
4. **Diagnostic harmonization**: align expected-vs-actual codes for overflow and match exhaustiveness.

## E) Related non-spec test pipeline issue (separate)

From `npm test`, there is also an unrelated blocker before exhaustive audit execution in that sequence:

- `src/test/js/selfhost-test.ts:30:2` transform error (`Unexpected ']'`).

This is a test file syntax issue, not a language-spec gap, but it currently blocks full pipeline completion.
