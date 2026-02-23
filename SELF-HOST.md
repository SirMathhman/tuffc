# Tuff Self-Hosted Compiler — Bootstrap Roadmap

_Last updated: 2026-02-17_

The Tuff compiler is fully self-hosted. The canonical source is `src/main/tuff/selfhost.tuff`,
compiled to a native CLI by the prior stage. The bootstrap path was:

**Bootstrap Path (completed)**:
Stage 0 (JS, now removed) → Stage 1 (Tuff-lite) → Stage 2 (Full Tuff) → Stage 3 (selfhost.tuff, current)

## Status summary (2026-02-17)

| Phase                                | Status                                                 |
| ------------------------------------ | ------------------------------------------------------ |
| Phase 1 — Stage 0 JS Bootstrap       | ✅ Complete (Stage 0 code removed)                     |
| Phase 2 — Stage 1 Tuff-lite compiler | ✅ Complete (bootstrap equivalence passes)             |
| Phase 3 — Stage 2 Full Tuff          | ✅ Complete (strict mode active)                       |
| Phase 4 — Production readiness       | 🔄 Active (diagnostics done; C backend M2 in progress) |

---

## Phase 1: Stage 0 — JavaScript Bootstrap Compiler ✅ (removed)

Stage 0 was a TypeScript compiler covering the Tuff-lite subset. It bootstrapped
Stage 1 and has now been removed from the repository. `src/main/js/` retains only
the thin JS harness (CLI, error types, runtime bindings). See git history for the
original Stage 0 implementation.

---

## Phase 2: Stage 1 — Tuff Compiler in Tuff-lite ✅

**Goal**: Rewrite the Stage 0 compiler in Tuff-lite, compile it using Stage 0.

**Steps**:

1. **Port Lexer** — Direct translation from JS to Tuff. (~1-2 days)
2. **Port Parser** — Translate parser, using Tuff structs for AST nodes. (~3-4 days)
3. **Port Desugaring** — Pattern matching over AST, Tuff enums for node types. (~2 days)
4. **Port Name Resolution** — Use hashmaps (implement or use simple array-based map). (~2 days)
5. **Port Type Checker** — Most complex port; ensure generics work correctly. (~1 week)
6. **Port Codegen** — String building for JS output. (~3-4 days)
7. **Bootstrap Test** — Compile Stage 1 with Stage 0, then compile Stage 1 with itself. Outputs must match (modulo comments/whitespace). (~2-3 days)

**Validation**: `stage0(stage1.tuff) == stage1_a.js` and `stage1_a(stage1.tuff) == stage1_b.js` should produce equivalent output.

Bootstrap equivalence passes. Run: `bun run stage1:bootstrap`

---

## Phase 3: Stage 2 — Full Tuff Compiler ✅

**Goal**: Add remaining language features to the self-hosted compiler.

**Steps** (can run in parallel once Stage 1 stable):

1. **Module System** — Java-style `com::meti::Module` paths, file mapping, `let { } = module` imports. (_depends on Phase 2_)
2. **Refinement Types** — Add constraint generation to type checker: `I32 < 100`, `I32 != 0`. Integrate Z3 via WASM or implement decision procedure for linear arithmetic. (_parallel with step 1_)
3. **Control-Flow Sensitivity** — Type narrowing through `if`/`match` branches. Track refinements per branch. (_depends on step 2_)
4. **Division/Overflow Proofs** — Implement proof obligations for `/`, `+`, `-`, `*`. Reject programs that can't prove safety. (_depends on step 3_)
5. **Array Bounds Proofs** — For `arr[i]`, require proof that `i < arr.init`. Track array sizes through types. (_depends on step 3_)
6. **Ownership & Borrowing** — Borrow checker: track borrows, enforce one-mut-xor-many-shared rule. Model as dataflow analysis. (_parallel with steps 4-5_)
7. **Lifetime Analysis** — Ensure references don't outlive referents. Simple region-based approach initially. (_depends on step 6_)
8. **Full Pattern Matching** — Exhaustiveness checker, range patterns, nested destructuring. (_parallel with step 1_)
9. **Async/Await Desugaring** — CPS transformation as specified. Pure syntactic transform. (_parallel with step 1_) — **pending**

Stage 2 strict mode is active (`--stage2` flag). Ownership/borrowing, safety proofs, module graph, and match exhaustiveness are all implemented. `async fn` CPS surface remains pending.

Run: `bun run stage2:verify`

---

## Phase 4: Production Readiness 🔄

**Steps**:

1. **Error Messages** — Counterexample-guided diagnostics from SMT failures. Show concrete failing values. ✅ Structured 4-part diagnostics (`source`/`cause`/`reason`/`fix`) and stable error codes are implemented.
2. **LLVM Backend** — Emit LLVM IR for native compilation. Share frontend with JS backend. (_pending_)
3. **Standard Library** — Core types: `String`, `Vec`, `HashMap`, I/O, etc. (_in progress via `tuff-core`/`tuff-c`/`tuff-js`_)
4. **Build System** — Dependency management, incremental compilation, package registry integration. (_pending_)
5. **Tooling** — Formatter, linter, language server for IDE support. (_linter shipped; LSP pending_)

---

## File Structure

- `src/main/js/lexer.ts` → `src/main/tuff/lexer.tuff` — Tokenization logic
- `src/main/js/parser.ts` → `.tuff` — Recursive descent parser
- `src/main/js/desugar.ts` → `.tuff` — CST to Core transformation
- `src/main/js/resolve.ts` → `.tuff` — Name resolution, scope analysis
- `src/main/js/typecheck.ts` → `.tuff` — Type inference, constraint generation
- `src/main/js/borrowcheck.ts` → `.tuff` — Ownership and borrow checking
- `src/main/js/codegen-js.ts` → `.tuff` — JavaScript code generation
- `src/main/js/codegen-c.ts` → `.tuff` — C code generation
- `src/main/tuff-core/` — Cross-platform `expect` API definitions
- `src/main/tuff-c/` — C target `actual` implementations
- `src/main/tuff-js/` — JS target `actual` implementations
- `src/test/` — Organized by language (`js`, `tuff`) and feature coverage

---

## Verification

**Phase 1** ✅:

- Unit tests per phase using snapshot/golden testing
- Parse all syntax examples from SPECIFICATION.md
- Type-check valid programs, reject invalid ones with correct errors
- Compile and execute: `factorial(5) == 120`

**Phase 2** ✅:

- **Bootstrap equivalence**: Stage 0 and Stage 1 produce identical output for test suite
- **Self-compilation**: Stage 1 compiles itself successfully
- Triple compilation: `stage1(stage1) == stage1(stage1(stage1))`

**Phase 3** ✅:

- Property-based tests: generate programs violating safety, verify rejection
- Specific tests per SPECIFICATION.md Appendix B examples
- `safeDivide`, `getElement`, `safeAdd` examples must type-check
- Programs with division-by-zero potential must fail compilation

**Phase 4** 🔄:

- Structured diagnostics: ✅ complete
- Native binaries: pending LLVM backend
- Performance benchmarks vs C: pending
- Full test suite passes on both JS and native backends: JS ✅, native 🔄

---

## Key Decisions

- **Bootstrap in JavaScript** targeting JS output for fastest iteration
- **Defer refinement types, ownership, borrowing until Stage 2** — not needed for bootstrap
- **No Z3 / SMT solver** — proof obligations handled by the type-level constraint system in the compiler directly; no external solver dependency planned
- **Monomorphize generics** in JS codegen (no runtime generic dispatch)
- **Runtime array bounds checks in Stage 0/1** — proof-based checks in Stage 2
- **Single-file programs until Phase 2 step 1** — module system added in Phase 2
- **No `throw` in compiler code** — ESLint enforces throw-ban; use `Result<T,E>` from `src/main/js/result.ts`
- **Exclude**: macros, attributes, standard library design (per spec: deferred)

---

## Estimated Timeline

These were the original estimates. All phases through Phase 3 are complete.

- **Phase 1**: ~4-5 weeks — ✅ Done
- **Phase 2**: ~3-4 weeks — ✅ Done
- **Phase 3**: ~6-8 weeks — ✅ Done
- **Phase 4**: ~8-12 weeks — 🔄 In progress (diagnostics done; C backend active; LLVM pending)

**Self-hosting achieved** (Phase 2 complete).
**Full safety guarantees** (Phase 3 complete).
