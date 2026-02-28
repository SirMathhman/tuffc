# Tuff Collection Anti-Patterns & Optimizations

Companion research to `plan-buildPerformanceOptimizations.prompt.md` — focuses on .tuff source-level collection bottlenecks that directly slow down `selfhost.tuff → selfhost.js` compilation (Stage 1 of build).

---

## Critical Findings

### V. `pGetPrecedence()` — 28 Map Lookups Per Binary Expression (CRITICAL)

**File:** `Tuffc/src/main/tuff/selfhost/parserExpr.tuff` lines 31-78

Every binary expression parse calls `pGetPrecedence(op)`, which does:

- **14 `mapHas()` calls** on the global `internMap`
- **14 `mapGet()` calls** on the same map

The intern map never changes after lexing, so these lookups are **pure overhead for values that could be cached once**.

```tuff
fn pGetPrecedence(op: I32) : I32 => {
    if (internMap.mapHas("||") && op == internMap.mapGet("||")) { return 1; }
    if (internMap.mapHas("&&") && op == internMap.mapGet("&&")) { return 2; }
    if (internMap.mapHas("==") && op == internMap.mapGet("==")) { return 3; }
    // ... 11 more operators ...
}
```

**Fix:** Cache operator intern indices once at module initialization:

```tuff
let OP_OR = 0;
let OP_AND = 0;
let OP_EQ = 0;
// ... etc
fn initOperatorPrecedence() => {
    OP_OR = intern("||");
    OP_AND = intern("&&");
    OP_EQ = intern("==");
    // ...
}
```

Then `pGetPrecedence` becomes direct integer comparison — **zero map lookups per call**:

```tuff
if (op == OP_OR) return 1;
else if (op == OP_AND) return 2;
// ...
```

**Impact:** Eliminates ~28 map operations per binary expression × thousands of binary expressions in a typical file = **tens of thousands of redundant hash lookups removed per compilation**.

---

### W. `moduleHasOutExport()` — 13 Full-Text Source Scans Per Symbol (CRITICAL)

**File:** `Tuffc/src/main/tuff/selfhost/moduleLoader.tuff` lines 578-591

For every imported symbol, this function performs **13 separate `strIncludes()` calls** on the entire module source file, with a freshly-allocated `strConcat()` string for each check:

```tuff
fn moduleHasOutExport(source: *Str, name: *Str) : Bool => {
    source.strIncludes("out extern fn ".strConcat(name)) ||
    source.strIncludes("extern out fn ".strConcat(name)) ||
    source.strIncludes("out fn ".strConcat(name)) ||
    source.strIncludes("out struct ".strConcat(name)) ||
    source.strIncludes("out copy struct ".strConcat(name)) ||
    source.strIncludes("copy out struct ".strConcat(name)) ||
    source.strIncludes("out enum ".strConcat(name)) ||
    source.strIncludes("out object ".strConcat(name)) ||
    source.strIncludes("out contract ".strConcat(name)) ||
    source.strIncludes("out type ".strConcat(name)) ||
    source.strIncludes("out copy type ".strConcat(name)) ||
    source.strIncludes("copy out type ".strConcat(name)) ||
    source.strIncludes("out class fn ".strConcat(name))
}
```

For the 43-module selfhost with hundreds of cross-module imports: **thousands of full-text string scans** during module loading.

**Fix:** Build a `Set<Str>` of exported names during the initial module source parse (one pass), then do O(1) set membership check per import:

```tuff
let moduleExports = setNew();  // During module parse
fn buildModuleExports(source: *Str, exports: *mut Set<Str>) => {
    // Parse 'out' declarations and add to set
}

fn moduleHasOutExport(exports: *mut Set<Str>, name: *Str) : Bool => {
    exports.setHas(name)  // O(1) instead of 13 scans
}
```

**Impact:** Eliminates **~13x full-text scans** for every imported symbol. With hundreds of imports, this is **potentially several seconds** saved during the module loading phase.

---

## High-Impact Findings

### X. 36+ Maps/Sets Rebuilt From Scratch Per Compilation (HIGH)

Global map/set variables in multiple compiler passes are allocated fresh (`mapNew()`/`setNew()`) on every compilation instead of being reused.

**typecheckImpl.tuff** (14 maps, lines 550-572 declaration + 1359-1677 reset):

```tuff
let tcArrayInitBounds : Map<I32, I32> = mapNew();
let tcIndexUpperBounds : Map<I32, I32> = mapNew();
let tcCallBounds : Map<I32, I32> = mapNew();
let fnParamCallBounds : Map<I32, I32> = mapNew();
let tcVarLiteralValues : Map<I32, I32> = mapNew();
let tcGlobalValueTypes : Map<I32, I32> = mapNew();
let tcAliasUnionTags : Map<I32, I32> = mapNew();
let tcTypeAliasNames : *mut Set<I32> = setNew();
let tcDepTypeAliasParams : Map<I32, I32> = mapNew();
let tcExternTypeParams : Map<I32, I32> = mapNew();
let tcContractNames : *mut Set<I32> = setNew();
let tcDestructorAliasByAlias : Map<I32, I32> = mapNew();
let tcAliasBaseType : Map<I32, I32> = mapNew();
let tcFnThisFields : Map<I32, I32> = mapNew();

// Then reset in tcCheckProgram at lines 1359-1677:
tcArrayInitBounds = mapNew();
tcIndexUpperBounds = mapNew();
// ... all 14 recreated ...
```

**codegenCImpl.tuff** (8 maps/sets, lines 27-39 + reset at line 1309):

- `ccEnumNames`, `ccEnumVariantConsts`, `ccStructFields`, `ccAliasByVariant`, `ccUnionAliasInfo`, `ccCoveredExternFns`, `ccLocalTypes`, `ccFnReturnTypes`

**resolver.tuff** (6 maps/sets, lines 43-79):

- `resolveGlobalDeclNodes`, `resolveExprOtherKindCounts`, and scope-related maps

**moduleLoader.tuff** (6 maps/sets, lines 783-789):

- `moduleDeclaredMap`, `moduleExportedMap`, `moduleSourceCache`, `importPathCache`, `allDeclaredNames`, `allExportedDeclaredNames`, `allExternDeclaredNames`

**linter.tuff** (2 maps, lines 1258-1259):

- `fpCache`, `sizeCache`

**Total: 36+ maps/sets** allocated fresh every compilation. Each `mapNew()`/`setNew()` creates a new JS Map/Set object, stressing garbage collection.

**Fix:** Add `mapClear()` and `setClear()` extern functions and reuse existing collections:

```tuff
extern fn mapClear(m: Map<K, V>) : Map<K, V>;
extern fn setClear(s: *mut Set<T>) : *mut Set<T>;

// Instead of: tcArrayInitBounds = mapNew();
tcArrayInitBounds = mapClear(tcArrayInitBounds);
```

**Impact:** Reduces GC pressure from 36+ map allocations per compilation, avoids repeated hash table initialization overhead. Moderate performance gain, but compounds across thousands of compilations on a developer's machine.

---

### Y. `vecLength()` Called in Loop Conditions — 100+ Occurrences (HIGH)

Loops repeatedly call `vecLength()` on every iteration instead of caching the length once before the loop.

**Worst offender: linter.tuff** (30+ instances):

```tuff
while (i < vecNodes.vecLength())  // Called every iteration
while (i < params.vecLength())
while (i < fields.vecLength())
while (i < cases.vecLength())
while (i < methods.vecLength())
```

Also found in:

- **borrowcheckImpl.tuff**: `while (loans.vecLength() > start)` in popping loop
- **resolver.tuff**: multiple uncached `vecLength()` in nested loops
- **parserExpr.tuff**: several loops

In JS runtime, `vecLength()` implementation goes through:

1. `asVecState()` check
2. `isVecState()` type guard (4 type checks)
3. Finally access `.init` property

Not a free operation when called thousands of times per file.

**Current pattern (inefficient):**

```tuff
while (i < vecNodes.vecLength()) {  // Recalculated every iteration
    i = i + 1;
}
```

**Correct pattern:**

```tuff
let len = vecNodes.vecLength();   // Cache once
while (i < len) {
    i = i + 1;
}
```

**Impact:** Eliminates thousands of redundant function calls + type checks per compilation. For a file with 1000 loops each iterating 10+ times, that's 10,000+ unnecessary `vecLength()` calls.

---

### Z. 200+ `strConcat` Chains — Should Use StringBuilder (HIGH)

The codebase has **200+ instances** of chained `strConcat()` calls. Each `.strConcat()` allocates a new immutable string. For code generation, this creates thousands of intermediate string objects per compilation.

**Worst offenders in codegen (hot paths):**

**codegenStmt.tuff line 84** — Single expression with **12 strConcat calls**:

```tuff
return "if (typeof __this_param !== 'undefined') { __this_param."
    .strConcat(prop).strConcat(" = ").strConcat(value)
    .strConcat("; } else { ").strConcat(prop).strConcat(" = ")
    .strConcat(value).strConcat("; if (typeof __tuff_this !== 'undefined') __tuff_this.")
    .strConcat(prop).strConcat(" = ").strConcat(prop).strConcat("; }");
```

**codegenExpr.tuff lines 100-103** — **11 strConcat calls** for into() converter:

```tuff
"(() => { const __src = ".strConcat(src)
    .strConcat("; const __conv = __src?.__into?.[")
    .strConcat("\"").strConcat(contractName).strConcat("\"")
    .strConcat("]; if (!__conv) { throw new Error(\"Missing into converter for ")
    .strConcat(contractLabel).strConcat("\"); } ")
    // ...
```

**codegenCImpl.tuff lines 491-530** — **32-pair strReplaceAll chain** (64 method calls total):

```tuff
raw.strReplaceAll("\\u0000", "\\000")
   .strReplaceAll("\\u0001", "\\001")
   .strReplaceAll("\\u0002", "\\002")
   // ... 29 more pairs ...
```

Each `.strReplaceAll()` allocates a new string. That's **32 string allocations** for escape processing of a single string.

**Diagnostic strings** across all files (lower frequency but numerous):

- resolver.tuff: 20+ strConcat chains for debug logging (lines 85-104, 164, 380, 445, 652-653, etc.)
- moduleLoader.tuff: 15+ strConcat chains for phase timing output
- parserCore.tuff lines 210-225: 15-link strConcat chain for parser error messages

**Fix for hot paths:** Replace with StringBuilder API:

```tuff
let sb = sbNew();
sbAppend(sb, "if (typeof __this_param !== 'undefined') { __this_param.");
sbAppend(sb, prop);
sbAppend(sb, " = ");
sbAppend(sb, value);
sbAppend(sb, "; } else { ");
sbAppend(sb, prop);
sbAppend(sb, " = ");
sbAppend(sb, value);
sbAppend(sb, "; if (typeof __tuff_this !== 'undefined') __tuff_this.");
sbAppend(sb, prop);
sbAppend(sb, " = ");
sbAppend(sb, prop);
sbAppend(sb, "; }");
return sbBuild(sb);
```

**Fix for strReplaceAll chain:** Build a single replacement map + iterate once:

```tuff
let escapeMap = mapNew();
mapSet(escapeMap, "\\u0000", "\\000");
mapSet(escapeMap, "\\u0001", "\\001");
// ... etc ...
fn escapeString(s: *Str, map: Map<*Str, *Str>) : *Str => {
    let sb = sbNew();
    // ... iterate and lookup ...
}
```

**Impact:** Each `strConcat` is an immutable string allocation. StringBuilder appends to a mutable array and does one `.join("")` at the end. For codegen emitting hundreds of statements, this is the **difference between hundreds of string objects vs tens**.

---

## Medium-Impact Findings

### AA. Redundant `mapHas()` + `mapGet()` Pairs (MEDIUM)

**codegenStmt.tuff lines 88-96:**

```tuff
if (dtorTypeMap.mapHas(typeName) || jsGlobalDtorTypeMap.mapHas(typeName)) {
    dtorVarNames.vecPush(getInternedStr(nodeGetData1(stmt)));
    if (dtorTypeMap.mapHas(typeName)) {      // REDUNDANT: mapHas called again
        dtorVarDtors.vecPush(dtorTypeMap.mapGet(typeName));
    }
}
```

**intern() function in runtimeLexer.tuff line 199:**

```tuff
fn intern(s: *Str) : I32 => {
    if (internMap.mapHas(s)) {
        internMap.mapGet(s)     // Second hash lookup for same key
    }
    // ...
}
```

Called for every token, so this redundancy repeats thousands of times per file.

**Fix:** Use single `mapGet()` with sentinel check or add `mapGetOrDefault()` extern:

```tuff
extern fn mapGetOrDefault(m: Map<K, V>, key: K, default: V) : V;

fn intern(s: *Str) : I32 => {
    let existing = mapGetOrDefault(internMap, s, -1);
    if (existing != -1) {
        existing
    } else {
        // insert new ...
    }
}
```

**Impact:** Eliminates redundant hash lookups. Matters most for `intern()` which is a hot path throughout lexing and parsing.

---

### BB. Scope Stack Creates Fresh `setNew()` Per Scope (MEDIUM)

**resolver.tuff**: 16+ `setNew()` calls for scope creation (lines 197, 222, 237, 256, 284, 349, 372, 374, 387, 666, etc.)
**moduleLoader.tuff**: 10+ `setNew()` calls (lines 227, 449, 463, 522, 549, etc.)

Every function declaration, block statement, match arm, and if expression creates a new Set for scope tracking. For deeply nested code, this creates many short-lived Set objects.

**Fix:** Use a scope pool pattern — maintain a free-list of recently-cleared Sets and recycle them:

```tuff
let scopePool : Vec<*mut Set<I32>> = vecNew();

fn getScopeFromPool() : *mut Set<I32> => {
    if (scopePool.vecLength() > 0) {
        scopePool.vecPop()
    } else {
        setNew()
    }
}

fn returnScopeToPool(s: *mut Set<I32>) => {
    s.setClear();
    scopePool.vecPush(s);
}
```

**Impact:** Reduces allocation churn in deeply nested code. Compounds with hundreds of scopes created during a typical compilation.

---

### CC. 4 Parallel Token Vectors — Should Use Stride Storage (MEDIUM)

**runtimeLexer.tuff**: Tokens are stored in 4 separate parallel vectors:

```tuff
let tokKinds : Vec<I32> = vecNew();
let tokValues : Vec<I32> = vecNew();
let tokLines : Vec<I32> = vecNew();
let tokCols : Vec<I32> = vecNew();

// Usage:
tokKinds.vecPush(kind);
tokValues.vecPush(value);
tokLines.vecPush(line);
tokCols.vecPush(col);
```

Each `vecPush` has overhead: `asVecState()` check, capacity check, `.init++`. For N tokens, that's **4N push operations** instead of N.

**Fix:** Use stride-4 encoding in a single vector:

```tuff
let tokens : Vec<I32> = vecNew();  // [kind0, value0, line0, col0, kind1, value1, ...]

fn pushToken(kind: I32, value: I32, line: I32, col: I32) => {
    tokens.vecPush(kind);
    tokens.vecPush(value);
    tokens.vecPush(line);
    tokens.vecPush(col);
}

fn getTokenKind(idx: I32) : I32 => tokens.vecGet(idx * 4);
fn getTokenValue(idx: I32) : I32 => tokens.vecGet(idx * 4 + 1);
```

**Impact:** Reduces vector growth operations from 4 per token to 1. Simplifies data locality and eliminates 3 parallel array growth strategies.

---

### DD. Borrow Checker State Cloning — Element-by-Element Copy (MEDIUM)

**borrowcheckImpl.tuff lines 348-380**: `stateClone()` copies 6+ state vectors with manual `while` loops:

```tuff
while (i < srcMoved.vecLength()) {    // vecLength re-called every iteration
    newVec.vecPush(srcMoved.vecGet(i));
    i = i + 1;
}
// Repeated for 6+ state vectors
```

**Fix:** Add a `vecClone()` extern that does the copy in one call:

```tuff
extern fn vecClone(v: Vec<T>) : Vec<T>;

fn stateClone(src: Vec<I32>) : Vec<I32> => {
    vecClone(src)  // Single operation instead of loop
}
```

**Impact:** Replaces N iterations + N type checks with one array slice operation.

---

### EE. Linear Loan Conflict Scanning in Borrow Checker (MEDIUM)

**borrowcheckImpl.tuff lines 349-363**:

```tuff
fn stateAnyConflictingLoan(state: Vec<I32>, base: *Str, path: *Str) : Bool => {
    let loans = stateLoans(state);
    let i = 0;
    while (i < loans.vecLength()) {   // Linear scan every time
        let e = loans.vecGet(i);
        let eb = e.vecGet(1);
        let ep = e.vecGet(2);
        if (placesConflict(base, path, eb, ep)) {
            return true;
        }
        i = i + 1;
    }
    false
}
```

Called repeatedly during borrow checking. With mutable borrows, can be O(n²) or worse.

**Fix:** Index loans by base name in a Map for O(1) lookup:

```tuff
let loansByBase : Map<*Str, Vec<I32>> = mapNew();

fn buildLoanIndex(loans: Vec<I32>) => {
    // Group loans by base name
    let i = 0;
    while (i < loans.vecLength()) {
        let e = loans.vecGet(i);
        let eb = e.vecGet(1);
        let existing = mapGetOrDefault(loansByBase, eb, vecNew());
        vecPush(existing, e);
        mapSet(loansByBase, eb, existing);
        i = i + 1;
    }
}

fn stateAnyConflictingLoan(base: *Str, path: *Str) : Bool => {
    let loans = mapGetOrDefault(loansByBase, base, vecNew());
    // Check only relevant loans
}
```

**Impact:** Transforms O(total_loans) scans into O(loans_for_base) lookups.

---

### FF. `triviaAdd()` Builds Records via 6 strConcat Calls (LOW)

**runtimeLexer.tuff lines 644-650**: Every trivia record (comments, whitespace) is built with 6 strConcat calls:

```tuff
triviaRecords.vecPush(
    kind
    .strConcat(triviaSepField())
    .strConcat(text)
    .strConcat(triviaSepField())
    .strConcat(intToString(line))
    .strConcat(triviaSepField())
    .strConcat(intToString(col))
);
```

**Fix:** Use StringBuilder or store trivia as a structured Vec with 4 fields instead of a serialized string:

```tuff
let triviaKinds : Vec<I32> = vecNew();
let triviaParts : Vec<*Str> = vecNew();
let triviaLines : Vec<I32> = vecNew();
let triviaCols : Vec<I32> = vecNew();
```

**Impact:** Low — few trivia records per file, but eliminates unnecessary string allocations.

---

## Summary Table

| Priority     | ID  | Optimization                                              | Files Affected                                               | Est. Savings                               |
| ------------ | --- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| **Critical** | V   | Cache operator intern indices in pGetPrecedence           | parserExpr.tuff                                              | tens of thousands of map lookups           |
| **Critical** | W   | Replace moduleHasOutExport source scans with exported Set | moduleLoader.tuff                                            | seconds during module loading              |
| **High**     | X   | Reuse maps/sets instead of mapNew/setNew                  | typecheckImpl, codegenCImpl, resolver, moduleLoader, linter  | reduces GC pressure, allocation overhead   |
| **High**     | Y   | Cache vecLength() before loops in 100+ places             | linter (30+), borrowcheckImpl, resolver, all files           | thousands of function calls eliminated     |
| **High**     | Z   | Convert 200+ strConcat chains to StringBuilder            | codegenStmt, codegenExpr, codegenCImpl, resolver, parserCore | fewer object allocations per compilation   |
| **Medium**   | AA  | Eliminate mapHas+mapGet redundant pairs                   | codegenStmt, runtimeLexer (intern)                           | reduces hash lookups per token             |
| **Medium**   | BB  | Pool scope Sets for reuse                                 | resolver, moduleLoader                                       | reduces allocation churn in nested code    |
| **Medium**   | CC  | Stride-4 token storage in single Vec                      | runtimeLexer                                                 | simplifies growth, improves cache locality |
| **Medium**   | DD  | Add vecClone() extern                                     | borrowcheckImpl                                              | replaces loops with single operation       |
| **Medium**   | EE  | Index loans by base in Map                                | borrowcheckImpl                                              | transforms O(n²) to O(1) borrow checks     |
| **Low**      | FF  | StringBuilder for trivia records                          | runtimeLexer                                                 | eliminates minor allocations               |
