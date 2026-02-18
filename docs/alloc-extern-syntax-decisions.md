# Alloc/Extern Syntax Decisions

_Date: 2026-02-17_

This document records language-design decisions for the proposed syntax:

```tuff
extern let { malloc } = stdlib;

type Alloc<T> = T then free;

extern fn malloc<T, L : USize>() : Alloc<*mut [T; 0; L]> | 0USize;
extern fn free<T>(alloc : Alloc<*mut [T; _; _]>) : Void;
```

## Confirmed decisions

1. **`Alloc<T>` is linear/affine resource-typed**
   - `type Alloc<T> = T then free;` means move-only ownership with required cleanup.
   - An `Alloc<...>` value must be consumed by exactly one matching `free(...)` call.

2. **`free` signature shape correction**
   - The intended signature uses wildcard lengths, not a named undeclared length param:
     - `extern fn free<T>(alloc : Alloc<*mut [T; _; _]>) : Void;`

3. **`extern let { malloc } = stdlib;` backend intent (C)**
   - For C emission, this maps to including stdlib:
     - `#include <stdlib.h>`

4. **Enforcement level**
   - Enforcement should be **compile-time strict**.
   - Borrow/type phases should diagnose misuse (not runtime-only).

## Practical implications (for implementation)

- Treat `Alloc<...>` as a tracked resource in ownership flow.
- Emit compile-time diagnostics for at least:
  - leak (not freed before scope end),
  - double free,
  - use-after-free.
- Keep `malloc` nullable contract as written:
  - `Alloc<...> | 0USize`.

## Notes

- These decisions are intentionally backend-aware for C (`stdlib.h`).
- Non-C backend mapping for `extern let { ... } = stdlib` is still implementation-defined.
