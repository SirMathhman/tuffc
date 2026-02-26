# Result Migration Plan — "No-Panic" Implementation

**Goal**: Eliminate panics from the Tuff compiler and establish Result<T,E> as the standard error handling mechanism, demonstrating Tuff's "no-panic" value proposition.

**Problem with Previous Attempt**: The migration on main (commits ad47626..7c623b7) broke the bootstrap cycle by simultaneously:

1. Changing compiler functions to return Result
2. Not ensuring the compiler could compile Result-based code

This created a chicken-and-egg problem: the old compiler couldn't compile the new Result-based compiler.

## Two-Stage Strategy

### Stage 1: Result as Language Feature (NO compiler changes)

**Objective**: Add Result<T,E> support to the language WITHOUT modifying compiler internals.

**Deliverables**:

1. ✅ Add `Result.tuff` with `Result<T,E>`, `Ok<T>`, `Err<E>` type definitions
2. ✅ Add error type definitions (`errors/*.tuff`) as example domain types
3. ✅ Ensure parser/typechecker can parse and type-check Result types
4. ✅ Add test cases demonstrating Result usage in user code
5. ✅ Bootstrap: Compiler can compile Result-based programs
6. ✅ Validate: Native compiler builds with Result language support

**Success Criteria**:

- `npm run build` succeeds
- `npm run test` passes
- `npm run native:selfhost:parity` passes
- Test programs using Result<T,E> compile and run

**Key Point**: Compiler internals still use panic — but the language NOW SUPPORTS Result for users.

---

### Stage 2: Compiler Migration to Result (Incremental)

**Objective**: Incrementally migrate compiler internals from panic to Result.

**Strategy**: One module at a time, validating bootstrap at each step.

**Module Migration Order** (smallest to largest):

1. **runtime_lexer.tuff** - Small, leaf module (lexing utilities)
2. **resolver_utils.tuff** - Small utility module
3. **parser_core.tuff** - Core parser infrastructure
4. **parser_decls_let_extern.tuff** - Declaration parsing
5. **parser_decls.tuff** - Main declaration parser
6. **resolver.tuff** - Symbol resolution
7. **typecheck_impl.tuff** - Type checking
8. **borrowcheck_impl.tuff** - Borrow checking
9. **module_loader.tuff** - Module system

**Per-Module Migration Steps**:

1. **Identify panic sites**: Find all `panic_with_code()` calls
2. **Change signature**: Update function to return `Result<T, ErrorType>`
3. **Wrap returns**: Change `return value;` → `return Ok<T> { value: value };`
4. **Replace panics**: Change `panic_with_code(...)` → `return Err<E> { error: ErrorType { ... } };`
5. **Update callers**: Add error propagation (`match`, `?` operator when available)
6. **Test bootstrap**: Run `npm run build && npm run test && npm run native:selfhost:parity`
7. **Commit**: Single atomic commit per module
8. **Iterate**: Move to next module

**Success Criteria per Module**:

- Module compiles with Result signatures
- All tests pass
- Bootstrap cycle unbroken
- Native parity maintained

---

## Risk Mitigation

### Bootstrap Protection

- **Never break the build**: Each commit must pass all tests
- **Fallback ready**: Can revert any single commit without losing work
- **Incremental validation**: Test after EVERY module migration

### Error Propagation Patterns

```tuff
// Pattern 1: Early return with Err
fn parse_thing() : Result<I32, ParseError> => {
    if (bad_condition) {
        return Err<ParseError> {
            error: ParseError {
                code: "E_PARSE_THING",
                message: "...",
                reason: "...",
                fix: "...",
                line: p_line(),
                col: p_col()
            }
        };
    }
    return Ok<I32> { value: node };
}

// Pattern 2: Caller handles errors
fn caller() : Result<I32, ParseError> => {
    let result = parse_thing();
    match (result) {
        Ok<I32>: {
            let value = result.value;
            // continue with value
        }
        Err<ParseError>: {
            return result; // propagate error
        }
    }
}

// Pattern 3: ? operator (when implemented)
fn caller() : Result<I32, ParseError> => {
    let value = parse_thing()?; // auto-propagate errors
    return Ok<I32> { value: value };
}
```

---

## Implementation Timeline

**Week 1**: Stage 1 (Language Support)

- Day 1-2: Add Result types and test infrastructure
- Day 3-4: Validate bootstrap and native compilation
- Day 5: Documentation and test coverage

**Week 2-3**: Stage 2, Phase 1 (Parser)

- runtime_lexer.tuff
- parser_core.tuff
- parser_decls_let_extern.tuff
- parser_decls.tuff
- validate at each step

**Week 4**: Stage 2, Phase 2 (Resolver)

- resolver_utils.tuff
- resolver.tuff
- validate

**Week 5**: Stage 2, Phase 3 (Typechecker)

- typecheck_impl.tuff
- validate

**Week 6**: Stage 2, Phase 4 (Remaining)

- borrowcheck_impl.tuff
- module_loader.tuff
- codegen_c_impl.tuff (if needed)
- Final validation

---

## Validation Checklist

After EVERY change:

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (all core tests)
- [ ] `npm run native:selfhost:parity` achieves fixpoint
- [ ] No new compiler panics introduced
- [ ] Error messages maintain 4-part informative standard

Final validation (Stage 2 complete):

- [ ] Zero panic calls in compiler codebase (except truly unrecoverable errors)
- [ ] All errors use Result propagation
- [ ] Documentation updated
- [ ] GAPS.md updated with any remaining issues
- [ ] Demonstration programs showcase "no-panic" guarantee

---

## Rollback Strategy

If any step breaks bootstrap:

1. `git revert HEAD` (undo last commit)
2. Analyze failure
3. Fix incrementally with smaller changes
4. Test before committing

If multiple commits break bootstrap:

1. `git reset --hard <last-known-good-commit>`
2. Cherry-pick working changes
3. Rework problematic changes

---

## Current Status

- ✅ Milestone 2 (Native C Bootstrap) complete at commit 4eeb063
- ✅ Bootstrap cycle working
- ✅ Native compiler achieves fixpoint
- 🔄 Starting Stage 1: Result as Language Feature
