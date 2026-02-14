# Plan: Tuff Self-Hosted Compiler

Build a self-hosted Tuff compiler using JavaScript as the bootstrap language, targeting JavaScript output, with focus on self-hosting speed over feature completeness.

**Bootstrap Path**:
Stage 0 (JS) → compiles → Stage 1 (Tuff-lite) → compiles → Stage 2 (Full Tuff) → self-hosted

---

## Phase 1: Stage 0 — JavaScript Bootstrap Compiler

**Goal**: JavaScript compiler that handles "Tuff-lite" subset sufficient to write a compiler.

**Steps**:

1. **Lexer** — Tokenize Tuff source: identifiers, keywords, literals, operators, punctuation. Track source positions for error reporting. (~2-3 days)
2. **Parser** — Recursive descent parser producing CST. Support: `fn`, `let`, `struct`, `type` aliases, `match`/`case`, `if`/`else`, `for`/`while`, generics. (~1 week)
3. **Desugaring** — Transform CST to Core AST. Expand `class fn` syntax, simplify pattern matching to decision trees. (~3-4 days)
4. **Name Resolution** — Scope analysis, detect shadowing errors (per spec), resolve imports. Single-file initially. (~2-3 days)
5. **Type Inference** — Bidirectional type checking for structs, functions, generics. **Skip refinement types and ownership** for Stage 0. (~1.5 weeks)
6. **JavaScript Codegen** — Emit JavaScript: functions→functions, structs→classes, match→switch/if chains, generics→monomorphization or erasure. (~1 week)
7. **CLI & Test Harness** — `tuff compile file.tuff`, basic test runner with snapshot testing. (~2-3 days)

**Tuff-lite Subset** (sufficient for writing a compiler):

- Primitives: `I32`, `Bool`, `*Str`, `USize`
- `fn` definitions (including generics)
- `struct` with fields
- `type` aliases and union types (`|`)
- `Option<T>`, `Result<T, E>` pattern
- Pattern matching (`match`/`case`, `is`)
- Arrays `[T; N; N]` with basic bounds (runtime checks ok for Stage 0)
- Basic operators, control flow
- **No** refinement types, dependent types, ownership/borrowing, `async`

---

## Phase 2: Stage 1 — Tuff Compiler in Tuff-lite

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

---

## Phase 3: Stage 2 — Full Tuff Compiler

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
9. **Async/Await Desugaring** — CPS transformation as specified. Pure syntactic transform. (_parallel with step 1_)

---

## Phase 4: Production Readiness

**Steps**:

1. **Error Messages** — Counterexample-guided diagnostics from SMT failures. Show concrete failing values. (_depends on Phase 3 steps 4-5_)
2. **LLVM Backend** — Emit LLVM IR for native compilation. Share frontend with JS backend. (_parallel with step 1_)
3. **Standard Library** — Core types: `String`, `Vec`, `HashMap`, I/O, etc. (_parallel with step 1_)
4. **Build System** — Dependency management, incremental compilation, package registry integration. (_parallel with step 3_)
5. **Tooling** — Formatter, linter, language server for IDE support. (_after steps 1-4_)

---

## File Structure

- `src/main/js/lexer.ts` (then `src/main/tuff/lexer.tuff`) — Tokenization logic
- `src/main/js/parser.ts` → `.tuff` — Recursive descent parser
- `src/main/js/ast.js` → `.tuff` — AST node definitions (structs/enums)
- `src/main/js/desugar.ts` → `.tuff` — CST to Core transformation
- `src/main/js/resolve.ts` → `.tuff` — Name resolution, scope analysis
- `src/main/js/typecheck.ts` → `.tuff` — Type inference, constraint generation
- `src/main/js/constraints.js` → `.tuff` — Refinement constraint representation
- `src/main/js/solver.js` → `.tuff` — SMT integration / decision procedure
- `src/main/js/borrow.js` → `.tuff` — Ownership and borrow checking
- `src/main/js/codegen/js.js` → `.tuff` — JavaScript code generation
- `src/main/js/codegen/llvm.tuff` — LLVM IR generation (Phase 4)
- `src/test/` — Organized by language (`js`, `tuff`) and feature coverage

---

## Verification

**Phase 1**:

- Unit tests per phase using snapshot/golden testing
- Parse all syntax examples from SPECIFICATION.md
- Type-check valid programs, reject invalid ones with correct errors
- Compile and execute: `factorial(5) == 120`

**Phase 2**:

- **Bootstrap equivalence**: Stage 0 and Stage 1 produce identical output for test suite
- **Self-compilation**: Stage 1 compiles itself successfully
- Triple compilation: `stage1(stage1) == stage1(stage1(stage1))`

**Phase 3**:

- Property-based tests: generate programs violating safety, verify rejection
- Specific tests per SPECIFICATION.md Appendix B examples
- `safeDivide`, `getElement`, `safeAdd` examples must type-check
- Programs with division-by-zero potential must fail compilation

**Phase 4**:

- Native binaries execute correctly
- Performance benchmarks vs C for compute-heavy code
- Full test suite passes on both JS and native backends

---

## Key Decisions

- **Bootstrap in JavaScript** targeting JS output for fastest iteration
- **Defer refinement types, ownership, borrowing until Stage 2** — not needed for bootstrap
- **Use Z3 via WebAssembly** for SMT solving (can be swapped for custom solver later)
- **Monomorphize generics** in JS codegen (no runtime generic dispatch)
- **Runtime array bounds checks in Stage 0/1** — proof-based checks added in Stage 2
- **Single-file programs until Phase 2 step 1** — module system not needed for bootstrap
- **Exclude**: macros, attributes, standard library design (per spec: deferred)

---

## Estimated Timeline

Working full-time:

- **Phase 1**: ~4-5 weeks
- **Phase 2**: ~3-4 weeks
- **Phase 3**: ~6-8 weeks
- **Phase 4**: ~8-12 weeks

**Self-hosting achieved** at end of Phase 2 (~8-9 weeks).  
**Full safety guarantees** at end of Phase 3.
