# Runtime ABI Matrix (Transitional C Runtime)

_Date: 2026-02-17_

This matrix is the Phase 0 source-of-truth for runtime surface area used by C-target compilation while we keep a **transitional dual-runtime path** (`tuff_runtime.c/.h` + growing `expect/actual` target libraries).

## Policy (current)

- `src/main/c/tuff_runtime.c` + `src/main/c/tuff_runtime.h` remain required for native C execution in the near term.
- `src/main/tuff/` contains target-agnostic `expect` declarations.
- `src/main/tuff-c/` contains C-target `actual` implementations that progressively own behavior.
- Runtime features are migrated in **capability groups**, not one symbol at a time.

## Capability groups

| Group               | C ABI Symbols                                                                                                                                                                                                       | Primary Consumers                                        | Current Status                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Strings             | `str_length`, `str_char_at`, `str_slice`, `str_concat`, `str_eq`, `str_from_char_code`, `str_index_of`, `str_includes`, `str_starts_with`, `str_trim`, `str_replace_all`, `char_code`, `int_to_string`, `parse_int` | `src/main/tuff/selfhost/runtime_lexer.tuff`, generated C | Implemented in `tuff_runtime.c`; declaration drift noted in header comment for `str_length`. |
| Builders            | `sb_new`, `sb_append`, `sb_append_char`, `sb_build`                                                                                                                                                                 | selfhost runtime lexer and diagnostics flows             | Implemented; ownership semantics must stay explicit (builder consumed by `sb_build`).        |
| Vec                 | `vec_new`, `vec_push`, `vec_pop`, `vec_get`, `vec_set`, `vec_length`, `vec_clear`, `vec_join`, `vec_includes`                                                                                                       | selfhost lexer/token storage, generated C                | Implemented; semantics are dynamic array over `int64_t` values.                              |
| Map                 | `map_new`, `map_set`, `map_get`, `map_has`                                                                                                                                                                          | selfhost interning + lookup tables                       | Implemented; string keys canonicalized via managed string registry.                          |
| Set                 | `set_new`, `set_add`, `set_has`, `set_delete`                                                                                                                                                                       | selfhost keyword set and membership tests                | Implemented; string item canonicalization mirrors map behavior.                              |
| IO / Path           | `read_file`, `write_file`, `path_join`, `path_dirname`                                                                                                                                                              | selfhost file/module operations                          | Implemented; parent directory creation is runtime-assisted in `write_file`.                  |
| Diagnostics / Panic | `tuff_panic`, `print`, `print_error`, `panic`, `panic_with_code`                                                                                                                                                    | all runtime consumers                                    | Implemented; panic path aborts process and surfaces diagnostic context.                      |

## Current declaration map

### Canonical C declarations

- Header: `src/main/c/tuff_runtime.h`
- Implementation: `src/main/c/tuff_runtime.c`

### Tuff-facing declarations

- Selfhost extern contracts: `src/main/tuff/selfhost/runtime_lexer.tuff`
- Expect boundary (initial): `src/main/tuff/stdlib.tuff`
- C actual boundary (initial): `src/main/tuff-c/stdlib.tuff`

## Drift and risk notes (baseline)

1. `str_length` is actively used in selfhost extern declarations and runtime code paths, but header comment claims it is no longer needed.
2. Runtime contracts are currently represented in multiple places (C header, selfhost extern declarations, expect/actual stdlib) and must stay synchronized.
3. Transitional runtime ownership still spans C runtime symbols and target-library boundaries; capability cutover should remain grouped and gate-driven.

## Verification commands

- `npm run c:verify`
- `npm run expect:actual:verify`
- `npm run c:native:verify`
- `npm run c:verify:full`

Expected result: smoke/runtime/expect-actual/native CLI checks pass with runtime linkage.
