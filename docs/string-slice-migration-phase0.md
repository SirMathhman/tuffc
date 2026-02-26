# String Slice Migration — Phase 0 Baseline

Date: 2026-02-26

## Outcomes

- Enumerated `str_slice` callsites in selfhost sources and confirmed broad usage across parser/typecheck/codegen/lint paths.
- Verified that lifetime-qualified extern signatures compile in current selfhost pipeline.
- Chosen rollout mode: **incremental compatibility-first** (no one-shot semantic break).

## Validation Notes

- Compile probe succeeded for:
  - `lifetime t { extern fn str_slice(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str; }`
- No existing codebase usage of `lifetime { extern fn ... }` blocks was found prior to this migration.

## Callsite Risk Buckets

1. **Window-safe read-only checks**
   - suffix/prefix tests, tag parsing, and transient comparisons.
2. **Potential ownership-sensitive flows**
   - slices persisted into containers or reassigned in iterative transforms.
3. **Runtime ABI-sensitive paths**
   - C backend/runtime functions and bridge wiring where copy-vs-window semantics affect memory model.

## Phase Gate

Proceed with API surface additions (`str_copy`, compatibility window API) before runtime behavioral switch.