# Panic Elimination Tracking

This document tracks all remaining panic call sites after the Result migration.
As we eliminate each one, we mark it with ✅.

## Summary

**Total panic sites found: 35**

- Direct panic calls: 6
- panic_with_code calls: 14
- panic_with_code_loc calls: 6
- Helper functions that call panic: 9

## By File

### 1. selfhost.tuff (4 sites)

- [ ] Line 168: `panic_with_code("E_SELFHOST_INTERNAL_ERROR", ...)`
  - Context: Main compilation entry point error handling
  - Action needed: This is error output for Result errors - keep or refactor to return Result
- [ ] Line 202: `panic("Resolver error: ".str_concat(error.message))`
  - Context: Match case for resolver Err
  - Action needed: Already has Err case - this should be unreachable
- [ ] Line 203: `panic("Unexpected resolver result")`
  - Context: Default match case for resolver Result
  - Action needed: Remove once Result is fully typed
- [ ] Line 212: `panic("Typechecker error: ".str_concat(error.message))`
  - Context: Match case for typechecker Err
  - Action needed: Already has Err case - this should be unreachable
- [ ] Line 213: `panic("Unexpected typecheck result")`
  - Context: Default match case for typecheck Result
  - Action needed: Remove once Result is fully typed

### 2. module_loader.tuff (8 sites)

- [ ] Line 79: `panic_with_code("E_SELFHOST_UNSUPPORTED_CODEGEN_TARGET", ...)`
  - Context: Unsupported codegen target error
  - Action needed: Convert to Result<I32, ModuleError>
- [ ] Line 355: `panic_with_code("E_MODULE_PRIVATE_IMPORT", ...)`
  - Context: Import validation - symbol not exported
  - Action needed: Convert to Result<I32, ModuleError>
- [ ] Line 357: `panic_with_code("E_MODULE_UNKNOWN_EXPORT", ...)`
  - Context: Import validation - symbol not found
  - Action needed: Convert to Result<I32, ModuleError>
- [ ] Line 568: `panic_with_code(...)`
  - Context: Module validation error
  - Action needed: Convert to Result<I32, ModuleError>
- [ ] Line 609: `panic_with_code(...)`
  - Context: Module validation error
  - Action needed: Convert to Result<I32, ModuleError>
- [ ] Line 717: `panic("Resolver error: ".str_concat(error.message))`
  - Context: Match case for resolver Err
  - Action needed: Already has Err case - remove default
- [ ] Line 718: `panic("Unexpected resolver result")`
  - Context: Default match case
  - Action needed: Remove once Result is fully typed
- [ ] Line 725: `panic("Typechecker error: ".str_concat(error.message))`
  - Context: Match case for typechecker Err
  - Action needed: Already has Err case - remove default
- [ ] Line 726: `panic("Unexpected typecheck result")`
  - Context: Default match case
  - Action needed: Remove once Result is fully typed

### 3. runtime_lexer.tuff (5 sites)

All are lexer validation errors. Need to add Result to lexer functions.

- [ ] Line 371: `panic_with_code("E_LEX_INVALID_ESCAPE", ...)`
- [ ] Line 390: `panic_with_code("E_LEX_UNTERMINATED_STRING", ...)`
- [ ] Line 442: `panic_with_code("E_LEX_INVALID_NUMBER", ...)`
- [ ] Line 588: `panic_with_code("E_LEX_UNEXPECTED_CHARACTER", ...)`
- [ ] Line 618: `panic_with_code("E_LEX_UNTERMINATED_INTERPOLATION", ...)`
  - Context: All are lexer errors
  - Action needed: Convert lexer functions to Result<I32, LexError>

### 4. codegen_c_impl.tuff (2 sites)

- [ ] Line 130: `panic_with_code("E_EXTERN_UNKNOWN_SOURCE", ...)`
  - Context: Extern source validation
  - Action needed: Convert to Result<I32, CodegenError>
- [ ] Line 1189: `panic_with_code("E_EXTERN_NO_SOURCE", ...)`
  - Context: Extern source validation
  - Action needed: Convert to Result<I32, CodegenError>

### 5. borrowcheck_impl.tuff (4 sites + helper)

- [ ] Line 486: `fn panic_borrow(...)` - Helper function definition
  - Context: Helper for borrow errors
  - Action needed: Create Result-based helper instead
- [ ] Line 1047: `panic_with_code("E_TYPE_DESTRUCTOR_SIGNATURE", ...)`
  - Context: Destructor validation
  - Action needed: Convert to Result<I32, BorrowError>
- [ ] Line 1055: `panic_with_code("E_TYPE_DESTRUCTOR_NOT_FOUND", ...)`
  - Context: Destructor validation
  - Action needed: Convert to Result<I32, BorrowError>
- [ ] Line 1068: `panic_with_code("E_BORROW_INVALID_COPY_ALIAS", ...)`
  - Context: Copy alias validation
  - Action needed: Convert to Result<I32, BorrowError>

### 6. resolver_utils.tuff (4 sites + helper)

- [ ] Line 11: `fn rslv_utils_panic_node(...)` - Helper function definition
  - Context: Helper for resolver errors (used by resolver.tuff)
  - Action needed: Already covered by Phase 1 (resolver uses Result) - consider keeping as helper
- [ ] Lines 177, 186, 202, 256: 4 call sites to helper
  - Context: Scope validation errors
  - Action needed: Keep as helper or convert to Result

### 7. parser_decls.tuff (7 sites + 1 error handler)

- [ ] Lines 112, 124, 136, 148, 160, 170: 6 calls to `p_panic_loc(...)`
  - Context: Calls to helper function (defined in parser_core.tuff)
  - Action needed: Already converted in Phase 3 - these use p_panic_loc helper
- [ ] Line 563: `panic_with_code_loc(error.code, ...)`
  - Context: Error handling in match for Result
  - Action needed: Should propagate error instead of panicking
- [ ] Line 564: `panic("Unexpected parser result")`
  - Context: Default match case
  - Action needed: Remove once Result is fully typed

### 8. parser_core.tuff (1 helper + 1 call)

- [ ] Line 209: `panic(msg)`
  - Context: Inside p_error function
  - Action needed: Convert p_error to Result
- [ ] Line 231: `fn p_panic_loc(...)` - Helper function definition
  - Context: Helper for parser errors
  - Action needed: Already provided p_result_error alternative in Phase 3

### 9. typecheck_impl.tuff (1 helper + 6 calls)

- [ ] Line 26: `panic_with_code_loc(...)` inside tc_panic_loc
  - Context: Helper function that calls panic
  - Action needed: Already provided tc_result_error alternative in Phase 2
- [ ] Lines 79, 123, 131: 3 calls to `tc_panic_loc(...)`
  - Context: Calls to helper in Phase 2 migrated functions
  - Action needed: Already have tc_result_error alternative

## Strategy

### Phase 4A: Entry Points (10 sites)

Fix the "Unexpected result" default match cases first:

1. ✅ selfhost.tuff: 4 cases (lines 202-203, 212-213)
2. ✅ module_loader.tuff: 4 cases (lines 717-718, 725-726)
3. ✅ parser_decls.tuff: 2 cases (lines 563-564)

These are bootstrap workarounds that can be removed.

### Phase 4B: Validation Errors (15 sites)

Convert validation code to Result returns:

1. module_loader.tuff: 5 validation errors → ModuleError
2. runtime_lexer.tuff: 5 lexer errors → LexError
3. codegen_c_impl.tuff: 2 extern errors → CodegenError
4. borrowcheck_impl.tuff: 3 validation errors → BorrowError

### Phase 4C: Helper Functions (10 sites)

Decision point: Keep as panic helpers OR convert to Result:

1. tc_panic_loc + 3 call sites (typecheck_impl.tuff)
2. p_panic_loc + 1 call site (parser_core.tuff)
3. rslv_utils_panic_node + 4 call sites (resolver_utils.tuff)
4. panic_borrow + 0 direct calls (borrowcheck_impl.tuff)

These could remain as panic helpers for invariant validation IF we decide
they represent unrecoverable programming errors rather than user errors.

## Notes

- **Bootstrap Constraint**: Some conversions can't be tested until native bootstrap
- **Error Propagation**: Match on Result should propagate, not panic on Err case
- **Helper Pattern**: Some panic helpers may be appropriate for invariant violations
- **Total Sites**: 35 identified (may have missed some in comments/strings)
