# Runtime Removal Ledger

_Date: 2026-02-16_

This document is the authoritative removal contract for deleting:

- `src/main/c/tuff_runtime.c`
- `src/main/c/tuff_runtime.h`

## Hard gates

1. Generated C contains no `#include "tuff_runtime.h"`.
2. Native compile/link paths never reference `tuff_runtime.c`.
3. `npm run c:verify:full` passes with no dependency on `tuff_runtime.*` artifacts.
4. `npm run c:selfhost:verify` passes without `tuff_runtime.*` artifacts.
5. Runtime APIs for C target are owned by target libraries and/or compiler-emitted support code.

## Symbol ownership map

| Capability  | Symbol set                                                                                                                                                                                                          | New owner                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Strings     | `str_length`, `str_char_at`, `str_slice`, `str_concat`, `str_eq`, `str_from_char_code`, `str_index_of`, `str_includes`, `str_starts_with`, `str_trim`, `str_replace_all`, `char_code`, `int_to_string`, `parse_int` | Compiler-emitted C support unit (consumed by target-library actuals and legacy extern call sites during migration) |
| Builder     | `sb_new`, `sb_append`, `sb_append_char`, `sb_build`                                                                                                                                                                 | Compiler-emitted C support unit                                                                                    |
| Collections | `vec_*`, `map_*`, `set_*`                                                                                                                                                                                           | Compiler-emitted C support unit + target-library wrappers                                                          |
| IO/Path     | `read_file`, `write_file`, `path_join`, `path_dirname`                                                                                                                                                              | Compiler-emitted C support unit                                                                                    |
| Diagnostics | `tuff_panic`, `print`, `print_error`, `panic`, `panic_with_code`                                                                                                                                                    | Compiler-emitted C support unit                                                                                    |

## Migration policy

- Runtime behavior remains capability-group based.
- During migration, existing call-site symbol names stay stable while ownership shifts away from handwritten runtime files.
- Final deletion occurs only after selfhost C gate is green.

## 2026-02-17 checkpoint

- Runtime package topology is now active by default (`tuff-core`, `tuff-c`, `tuff-js`) with target-aware alias routing.
- Capability modules are present for Strings and Collections across all runtime packages.
- C codegen now references the substrate-oriented support API name (`getEmbeddedCSubstrateSupport`) while retaining compatibility wrapper naming.
- Stable symbol policy remains in effect (`str_*`, `vec_*`, `map_*`, `set_*`, IO/path/diagnostic symbols unchanged).
