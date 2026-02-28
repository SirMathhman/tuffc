# Build Performance Optimization Plan — npm run build

## Build Pipeline Overview

`npm run build` runs [scripts/build-both.ts](Tuffc/scripts/build-both.ts) which executes **3 sequential stages**, each spawning a **new `npx tsx` process**:

1. **Stage 1** — Compile `selfhost.tuff` → `selfhost.js` (via JS bootstrap)
2. **Stage 2** — C bootstrap parity (5-phase native build + fixpoint check)
3. **Stage 3** — Copy native exe to `dist/`

---

## Optimizations Found

### A. Eliminate Redundant `npx tsx` Process Spawns (High Impact)

[build-both.ts](Tuffc/scripts/build-both.ts) spawns **3 separate `npx tsx` child processes** sequentially. Each `npx tsx` invocation pays:

- Node.js startup (~200-500ms)
- tsx module resolution and TypeScript transpilation (~300-800ms)
- Module graph loading

**Fix:** Import the scripts directly as functions instead of spawning child processes. Replace `spawnSync("npx", ["tsx", ...])` with direct `await import()` calls. This saves **~1-3 seconds** of process overhead.

### B. Double SHA-256 Manifest Write (Medium Impact)

[build-selfhost-js.ts lines 316-328](Tuffc/scripts/build-selfhost-js.ts#L316-L328) calls `writeManifest(collectInputFiles())` **twice** — once after build, then again after syncing to `selfhost.generated.js`. Each call re-hashes **all 43 .tuff files + the 1.5MB generated JS** (SHA-256).

**Fix:** Only call `writeManifest()` once, after the sync. The first call's manifest is immediately invalidated by the `copyFileSync` anyway. Saves **~100-300ms** of disk I/O + hashing.

### C. `patchExternStubsToHostRuntime` Uses 50+ Regex Replacements Sequentially (Medium Impact)

[compiler.ts lines 90-104](Tuffc/src/main/js/compiler.ts#L90-L104) runs **one regex per extern function** (50+ functions) on the **1.5MB** selfhost JS string. Each regex does a full-text scan.

**Fix:** Build a single combined regex that matches all function stubs in one pass, or do a single `string.replace()` with a callback that dispatches by function name. This could reduce from 50+ full scans to **1 pass**. Saves **~50-200ms**.

### D. `vm.runInNewContext` Called 3 Times (Medium Impact)

[compiler.ts lines 455-530](Tuffc/src/main/js/compiler.ts#L455-L530) calls `vm.runInNewContext` three separate times to load the selfhost. Each call has V8 compilation + context-switching overhead.

**Fix:** Concatenate all three script fragments and execute once in a single `vm.runInNewContext` call. Saves **~50-150ms**.

### E. Cache the Loaded Selfhost Compiler Across Stages (High Impact)

Stage 1 (`build-selfhost-js.ts`) and Stage 2 (`c-bootstrap-parity.ts`) both load the selfhost compiler independently. Stage 2 calls `loadStageCompilerFromJs()` which re-reads, re-patches, and re-evaluates the same 1.5MB JS.

**Fix:** If stages are unified into a single process (see A), the `cachedSelfhost` variable in compiler.ts would persist, avoiding redundant loading. Saves **~500ms-2s**.

### F. SHA-256 Hashing of All Input Files on Every Cache Check (Medium Impact)

[build-selfhost-js.ts `isCacheValid()`](Tuffc/scripts/build-selfhost-js.ts#L130-L170) hashes **every** input file (43 .tuff files + 1.5MB generated JS) even on cache hits. The "fast pre-check" only compares file counts, not mtimes.

**Fix:** Add an mtime pre-check before content hashing. Compare `stat().mtimeMs` against stored values first. Only fall through to SHA-256 if mtimes differ. This is what the comment on line 8 says it does, but the code doesn't actually store or check mtimes. Saves **~100-500ms** on cache hits.

### G. `collectInputFiles()` Called Multiple Times (Low Impact)

`collectInputFiles()` does a recursive directory walk of `src/main/tuff/` and `src/main/tuff-core/`. It's called in `isCacheValid()` and twice in `writeManifest()` (due to the double-write in optimization B).

**Fix:** Cache the result of `collectInputFiles()` and reuse it. Saves **~10-30ms**.

### H. `asVecState` Type Checks on Every Vec Operation (Medium Impact — Compiler Runtime)

[runtime.ts](Tuffc/src/main/js/runtime.ts#L148-L155) — Every `vec_push`, `vec_get`, `vec_set`, `vec_length` call goes through `asVecState()` which calls `isVecState()` doing 4 type checks. For a compiler processing thousands of AST nodes, this adds up.

**Fix:** Since the selfhost always creates vecs via `vec_new()` (which returns `VecState`), the `isVecState` guard is unnecessary for the selfhost compiler path. Create an optimized "trusted" vec API for the selfhost runtime bridge. Could save **seconds** in aggregate during compilation.

### I. `vecEnsureCapacity` Doubling Strategy (Low Impact)

The vec growth strategy starts at capacity 4 and doubles. For known-large collections (like AST nodes, token arrays), pre-sizing would avoid multiple reallocations.

**Fix:** Pass realistic initial capacities from the selfhost compiler for known-large allocations.

### J. `sb_length()` Recalculates Every Time (Low Impact)

[runtime.ts](Tuffc/src/main/js/runtime.ts#L132-L134) — `sb_length()` does `reduce()` over all parts. If called frequently, cache the running length.

**Fix:** Track cumulative length in the StringBuilder object. Saves **negligible** unless called in hot loops.

### K. Stage 2 (C Bootstrap Parity) Does Redundant Work When Cache Is Valid (High Impact)

[c-bootstrap-parity.ts](Tuffc/src/test/js/c-bootstrap-parity.ts) has mtime-based caching for individual phases (stage3.c, stage3.o, stage3.exe), but **Phase 1 still loads the entire selfhost compiler into a VM** even when `canReuseStage3C` is true — just to set `stage3EmitResult = 0`.

The overall parity script has **no top-level skip**. Even with all phases cached, it still:

- Imports and initializes compiler modules
- Reads and writes the C substrate bundle to disk
- Loads the stage3 JS when Phase 1 isn't cached

**Fix:** Add a top-level mtime/hash cache for the entire parity pipeline (like Stage 1 has). If the stage3_selfhost_cli.exe is newer than all inputs, skip the entire script. Saves **~2-10s** when nothing changed.

### L. The `embeddedCSubstrate` Is Written to Disk Every Run (Low Impact)

[c-bootstrap-parity.ts line 50](Tuffc/src/test/js/c-bootstrap-parity.ts#L50) — `fs.writeFileSync(cSubstrateBundlePath, embeddedCSubstrate, "utf8")` writes the embedded C substrate every single run, even if cached.

**Fix:** Only write if content differs from existing file.

### M. Phase 4 Fixpoint Spawns Native Exe Even When Parity Already Achieved (Medium Impact)

[c-bootstrap-parity.ts lines 440-465](Tuffc/src/test/js/c-bootstrap-parity.ts#L440-L465) — The fixpoint check only reuses cache if `stage3.c == stage4.c`. But converting this to an mtime check on `stage3_selfhost_cli.exe` vs `stage4_selfhost.c` could skip the entire 30-60s native compilation.

**Fix:** If stage4_selfhost.c exists and is newer than all inputs + stage3_selfhost_cli.exe, skip Phase 4.

### N. Use `--no-borrow` for Stage 1 JS Build (Medium Impact)

Stage 1 compiles selfhost.tuff to JS with borrow checking enabled (default). The borrow checker adds significant overhead but is not required for a JS target where there's no memory management.

**Fix:** Pass `--no-borrow` to the Stage 1 compilation in [build-selfhost-js.ts](Tuffc/scripts/build-selfhost-js.ts#L227). Saves **~10-30%** of compilation time.

### O. Heartbeat `setInterval` in Hot Path (Negligible)

[compiler.ts lines 1280-1288](Tuffc/src/main/js/compiler.ts#L1280-L1288) — A 5-second interval timer runs during compilation. While not a performance issue itself, it keeps the event loop active and could interfere with V8 garbage collection heuristics.

**Fix:** Remove or gate behind a `--verbose` flag.

### P. `str_replace_all` Runtime Uses JS `.replaceAll()` — Fine, But `str_index_of` Is Duplicated (Negligible)

Runtime has both `str_index_of` and `__str_index_of` as separate exports. This is a code hygiene issue, not a performance one.

### Q. Use V8 Snapshots or Pre-compiled Bytecode for selfhost.generated.js (High Impact — Architectural)

The 1.5MB selfhost JS is re-parsed and JIT-compiled by V8 every time it's loaded via `vm.runInNewContext`.

**Fix:** Use V8's `vm.Script` with `cachedData` (bytecode caching). On first load, generate the bytecode cache and write it to disk. On subsequent loads, supply the cached bytecode. This can reduce selfhost load time from **~500ms to ~50ms**.

### R. Replace `vm` Sandbox with Direct `require`/`import` (High Impact — Architectural)

The `vm` module sandbox adds overhead for every function call across the boundary. Since the selfhost is trusted code, running it directly in the main context (via `Function()` constructor or writing a Node-compatible module) would eliminate per-call sandbox overhead.

**Fix:** Emit selfhost.generated.js as a proper ES module with explicit imports of the runtime functions. Load via dynamic `import()`. Eliminates the regex patching (C), the 3x vm.runInNewContext (D), and reduces per-call overhead.

### S. Parallelize Stage 1 and Stage 2 (High Impact — Architectural)

Stage 1 (JS build) and the C compilation phases of Stage 2 are largely independent if Stage 2 can use a **previously built** selfhost.js (not the one just produced). If parity was achieved in a prior build, Stage 2 only needs to verify it's still valid.

**Fix:** Run Stage 1 and Stage 2 concurrently (two child processes or `Promise.all`). Stage 2 uses the _previous_ selfhost.js output; Stage 1 produces a new one. If both succeed and outputs match, parity holds.

### T. `collectTuffFiles` Uses Synchronous Recursive `readdirSync` (Low Impact)

**Fix:** Use `fs.readdirSync(dir, { withFileTypes: true, recursive: true })` (Node 18.17+) for a single syscall instead of recursive directory walking.

### U. The `profile_take_json()` Is Called Twice Before Compilation (Negligible)

[compiler.ts lines 1268-1271](Tuffc/src/main/js/compiler.ts#L1268-L1271) — `runtime.profile_take_json()` is called twice in a row (likely a copy-paste bug). Harmless but wasteful.

---

## Summary by Impact

| Priority       | Optimization                          | Est. Savings               |
| -------------- | ------------------------------------- | -------------------------- |
| **High**       | K. Top-level parity cache skip        | 2-10s                      |
| **High**       | A. Eliminate npx tsx respawns         | 1-3s                       |
| **High**       | E. Cache selfhost across stages       | 0.5-2s                     |
| **High**       | Q. V8 bytecode caching for selfhost   | ~500ms                     |
| **High**       | R. Drop vm sandbox, use direct import | variable                   |
| **High**       | S. Parallelize Stage 1 + Stage 2      | up to 50% wall time        |
| **Medium**     | N. `--no-borrow` for JS target build  | 10-30% of Stage 1          |
| **Medium**     | H. Eliminate `asVecState` guards      | seconds across compilation |
| **Medium**     | B. Remove double manifest write       | 100-300ms                  |
| **Medium**     | C. Single-pass extern stub patching   | 50-200ms                   |
| **Medium**     | D. Single vm.runInNewContext call     | 50-150ms                   |
| **Medium**     | F. Add mtime pre-check before SHA-256 | 100-500ms on cache hits    |
| **Medium**     | M. Better fixpoint phase skip         | saves native exe spawn     |
| **Low**        | G. Cache collectInputFiles()          | 10-30ms                    |
| **Low**        | L. Skip substrate write if unchanged  | 10ms                       |
| **Low**        | T. Use recursive readdirSync          | ~5ms                       |
| **Negligible** | U. Remove duplicate profile_take_json | ~0                         |
| **Negligible** | O. Gate heartbeat behind --verbose    | ~0                         |

---

## Investigation Files

All build-related source files reviewed:

- [Tuffc/package.json](Tuffc/package.json) — build script entry point
- [Tuffc/scripts/build-both.ts](Tuffc/scripts/build-both.ts) — 3-stage orchestrator
- [Tuffc/scripts/build-selfhost-js.ts](Tuffc/scripts/build-selfhost-js.ts) — Stage 1 (JS compiler)
- [Tuffc/scripts/build-native-binary.ts](Tuffc/scripts/build-native-binary.ts) — Stage 3 (copy native exe)
- [Tuffc/src/test/js/c-bootstrap-parity.ts](Tuffc/src/test/js/c-bootstrap-parity.ts) — Stage 2 (5-phase parity)
- [Tuffc/src/main/js/compiler.ts](Tuffc/src/main/js/compiler.ts) — Core compiler API
- [Tuffc/src/main/js/cli.ts](Tuffc/src/main/js/cli.ts) — CLI entry point
- [Tuffc/src/main/js/runtime.ts](Tuffc/src/main/js/runtime.ts) — Extern runtime functions
- [Tuffc/src/main/js/c-runtime-support.ts](Tuffc/src/main/js/c-runtime-support.ts) — C codegen substrate

All 43 `.tuff` compiler modules (~520KB total) and selfhost outputs analyzed.
