# Iteration 1 - Generic read<T>() pipeline

## Objective

Add a minimal compiler path for `read<T>()` so pipeline tests can simulate stdin and evaluate typed reads end-to-end.

## User stories

- As a language implementer, I want `runPipeline("read<T>()", stdin)` to evaluate numeric input correctly, so parser/codegen plumbing can be validated before full language rollout.
- As a language implementer, I want little-endian decoding for multi-byte integer reads, so byte ordering is deterministic in tests.
- As a language implementer, I want signed integer reads to use two's-complement semantics, so negative values decode predictably.
- As a language implementer, I want `U64/I64` reads to produce `bigint`, while smaller integer types produce `number`.

## Scope notes

- `compileTuffToTS` keeps its current signature and does not accept stdin directly.
- Test pipeline supplies stdin as an argument to `runPipeline`.
- Out-of-bounds stdin behavior is intentionally undefined in this iteration (tests provide valid input).
