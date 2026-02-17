# Realloc Capacity Proof Design

Date: 2026-02-17

## Problem Statement

The current `realloc` signature has a proof gap:

```tuff
lifetime t {
    extern fn realloc<T, L : USize>(
        ptr : Alloc<*t [T; _; _ < L]>,
        bytesCount : SizeOf<T> * L
    ) : Alloc<*t [T; _; L]> | 0;
}
```

The constraint `_ < L` on input capacity creates two issues:

1. **Call-site proof burden**: When calling `realloc<T, NewCap>(slice, ...)`, how does the checker prove current capacity is strictly less than `NewCap`?
2. **Shrinking semantics**: The `_ < L` constraint forbids same-size or shrinking reallocs (where `OldCap >= NewCap`), which C's `realloc` permits.

## Vec Growth Context

In `Vec::set`, we need to grow when `index == slice.length`:

```tuff
if (index == slice.length) {
    let reallocated = realloc<T, slice.length * 2>(slice, sizeOf<T>() * slice.length * 2);
    // ...
}
```

Here, `slice : *[T; I; L]` with current `L = slice.length`. The call instantiates `realloc` with new capacity `2 * L`.

For the constraint `_ < 2*L` to be satisfied, we need to prove `L < 2*L`, which is trivial when `L > 0`.

But if `L == 0`, then `2*L == 0`, violating `_ < L`.

## Proposed Solutions

### Option A: Explicit Current Capacity (Runtime Check)

Add current capacity as an explicit parameter:

```tuff
extern fn realloc<T, OldL : USize, NewL : USize>(
    ptr : Alloc<*[T; _; OldL]>,
    oldBytes : SizeOf<T> * OldL,
    newBytes : SizeOf<T> * NewL
) : Alloc<*[T; _; NewL]> | 0
where OldL < NewL;
```

**Pros:**

- Explicit proof obligation at call site
- Forbids shrinking (matches constraint intent)
- Checker can verify `OldL < NewL` trivially

**Cons:**

- Requires passing old byte count (redundant for C `realloc`)
- Lifetime annotation `t` lost (may be recoverable)

### Option B: Growth-Only Witness (Strict Inequality)

Keep wildcard input, add strict growth constraint:

```tuff
lifetime t {
    extern fn realloc<T, OldL : USize, NewL : USize>(
        ptr : Alloc<*t [T; _; OldL]>,
        bytesCount : SizeOf<T> * NewL
    ) : Alloc<*t [T; _; NewL]> | 0
    where NewL > OldL;
}
```

**Pros:**

- Explicit growth proof
- Retains lifetime parameter
- No redundant size argument

**Cons:**

- Call site must name current capacity (forces type annotation burden)

### Option C: Separate Grow/Shrink Operations

Provide distinct extern declarations:

```tuff
lifetime t {
    extern fn realloc_grow<T, OldL : USize, NewL : USize>(
        ptr : Alloc<*t [T; _; OldL]>,
        bytesCount : SizeOf<T> * NewL
    ) : Alloc<*t [T; _; NewL]> | 0
    where NewL > OldL;

    extern fn realloc_shrink<T, OldL : USize, NewL : USize, I : USize>(
        ptr : Alloc<*t [T; I; OldL]>,
        bytesCount : SizeOf<T> * NewL
    ) : Alloc<*t [T; I; NewL]> | 0
    where NewL < OldL, NewL >= I;
}
```

**Pros:**

- Intent-clear API
- Shrink variant enforces `I <= NewL` invariant preservation
- Growth path avoids `I` constraint (init can be anything)

**Cons:**

- Duplicates extern mapping (both lower to C `realloc`)

### Option D: Remove Strict Inequality (Simplest)

Allow same-size reallocs, rely on growth check elsewhere:

```tuff
lifetime t {
    extern fn realloc<T, OldL : USize, NewL : USize>(
        ptr : Alloc<*t [T; _; OldL]>,
        bytesCount : SizeOf<T> * NewL
    ) : Alloc<*t [T; _; NewL]> | 0;
}
```

**Pros:**

- Matches C `realloc` semantics exactly
- No proof gaps
- Simplest signature

**Cons:**

- Allows no-op reallocs (not inherently bad)
- Growth verification becomes Vec's responsibility (check old != new before calling)

## Recommendation

**Option D (remove strict inequality) with defensive Vec logic** seems most pragmatic:

```tuff
out fn set(*mut a this, index : USize <= this.size(), element : T) : Option<*mut a Vec<T>> => {
    if (index == slice.length) {
        let newCap = max(slice.length * 2, 1); // Handle zero-capacity edge
        let reallocated = realloc<T, slice.length, newCap>(slice, sizeOf<T>() * newCap);
        if (reallocated == 0) return None<*mut a Vec<T>>;
        slice = reallocated;
    }
    slice[index] = element;
    Some<*mut a Vec<T>> { field : this.this }
}
```

This pushes growth policy (doubling, minimum capacity) into Vec where it belongs, and keeps `realloc` signature aligned with C semantics.

## Open Questions

1. Should we enforce `NewL >= I` (preserve init invariant) as a where-clause, or trust Vec to maintain it?
2. How to handle zero-capacity edge case (`DEFAULT_SIZE = 0` or exhausted shrink)?
3. Should `I` be exposed in growth path (Option C style), or kept opaque (`_`)?
