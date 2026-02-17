# Vec<T> Proof Semantics (Socratic Alignment)

Date: 2026-02-17

This document captures the current shared understanding of proof semantics for `Vec<T>` and array-pointer shapes, based on an interactive design walkthrough.

## 1) Pointer shape law (canonical)

### `*[T]` (unsized array pointer)

- Treated as a **fat runtime shape** with metadata conceptually equivalent to:
  - `{ ptr, init, length }`
- `init` and `length` are runtime values here.

### `*[T; I; L]` (sized/proven array pointer)

- Treated as a **thin raw pointer** in runtime layout.
- `I` and `L` are **proof metadata** (compile-time/type-level), not runtime header fields.

## 2) Core invariant

For any thin shape `*[T; I; L]`, maintain:

$$0 \le I \le L$$

Where:

- `I` = initialized prefix length
- `L` = capacity/total extent

## 3) Read vs write indexing rules

This was the key semantic split:

### Read (RHS)

- `x = arr[i]`
- Requires proof: `i : USize < I`

### Write (LHS)

- `arr[i] = v`
- Requires proof: `i : USize <= I`
- State transition:
  - If `i < I`: initialized prefix unchanged (`I' = I`)
  - If `i == I`: frontier extension (`I' = I + 1`)

This allows append-via-set semantics while forbidding holes.

## 4) `set` semantics for Vec

Given `set(index, element)` with signature constraint equivalent to:

- `index : USize <= this.size()`

Then:

- `index < init` => overwrite existing initialized element
- `index == init` => append/advance initialization frontier
- `index > init` => rejected (cannot create sparse holes)

## 5) Reallocation transformation (current intended law)

For thin pointers, the intended transform is:

- Input: `p : *[T; I; L]`
- On successful realloc to `L2`:
  - Output: `p2 : *[T; I; L2]`
  - Required side condition: `L2 >= I`

This preserves initialized-prefix proof across growth/shrink (as long as shrinking does not violate `I <= L2`).

## 6) Symbolic proofs (non-literal `I`, `L`)

Current leaning (to be confirmed by examples):

- For thin pointers, safety checks are proof-driven.
- If checker cannot prove required inequalities (`idx < I`, `L2 >= I`, etc.), compilation fails.
- No runtime fallback checks are inserted for thin proof obligations.

## 7) Confirmation examples

These examples are intended as “decision tests” for checker behavior.

### A. Frontier write should advance `I`

```tuff
fn write_frontier(p : *mut [I32; I; L], i : USize == I, v : I32) : *mut [I32; I + 1; L] => {
    p[i] = v;
    p
}
```

Expected: valid, with post-state init advanced.

### B. Read at frontier should fail

```tuff
fn bad_read_frontier(p : *[I32; I; L], i : USize == I) : I32 => p[i];
```

Expected: compile error (`i < I` not provable).

### C. Realloc preserving init

```tuff
fn grow<T, I : USize, L : USize, L2 : USize>(
    p : *[T; I; L],
    bytes : SizeOf<T> * L2
) : *[T; I; L2] | 0
where L2 >= I
=> realloc<T, L2>(p, bytes);
```

Expected: valid if `L2 >= I` is provable.

### D. Realloc shrinking below init should fail

```tuff
fn bad_shrink<T, I : USize, L : USize, L2 : USize>(
    p : *[T; I; L],
    bytes : SizeOf<T> * L2
) : *[T; I; L2] | 0
where L2 < I
=> realloc<T, L2>(p, bytes);
```

Expected: compile error (would violate `I <= L2`).

## 8) Open edge to settle explicitly

- Exact syntax/mechanism for expressing post-state type transitions (`I -> I + 1`) in assignment-heavy code paths.
- Whether checker models this as:
  1. direct type mutation on l-value write at frontier, or
  2. SSA-style refined binding after statement.

Either way, user-facing semantics should remain identical to the rules above.
