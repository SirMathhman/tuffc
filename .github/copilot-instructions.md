# Tuff Compiler - AI Coding Instructions

## Project Overview

**Tuff** is a compiler that translates `.tuff` source code into C. The compiler reads a single `.tuff` source file, parses it, analyzes language semantics, and generates two output C files: a header file (`main.h`) and an implementation file (`main.c`).

## Architecture & Data Flow

### Core Compilation Pipeline

The compiler is a **multi-stage translator** implemented entirely in [../src/common.c](../src/common.c):

1. **Lexing & Parsing**: Statement-level parsing
   - Handles `let` declarations with optional type annotations (e.g., `let x: USize = expr;`)
   - Parses expression terms (literals, identifiers, special `__args__` references)
   - Splits statements on `;` delimiters and trims whitespace

2. **Semantic Analysis**: Inline symbol tracking
   - Maintains `SymbolTable` of declared variables for scope validation
   - Rejects undefined identifiers and duplicate declarations with detailed error messages
   - Validates `__args__` access patterns (e.g., `__args__.length`, `__args__[1].length`)

3. **Codegen & Output**: Generates "boilerplate-free" C
   - Variable declarations → `int var = expr;`
   - Final expression → `return expr;`
   - Auto-includes headers (`<string.h>`) when needed
   - Conditionally adds `argc`/`argv` to `main()` signature based on usage

### Type System & Result Pattern

**Critical Design** ([../src/common.h](../src/common.h)): Tagged union for flexible error recovery:

```c
typedef struct {
    enum { OutputVariant, CompileErrorVariant } variant;
    union {
        Output output;           // {headerCCode, targetCCode}
        CompileError error;      // Rich error details
    };
} CompileResult;
```

- **Always check `variant` first** before accessing union fields
- `CompileError` includes: erroneous code snippet, message, reasoning, and fix suggestion
- This pattern enables graceful failure with actionable diagnostics

### Entry Points

- **[../src/exec.c](../src/exec.c)**: Compiler tool (`tuffc.exe`)—reads `main.tuff`, calls `compile()`, writes `main.h`/`main.c`
- **[../src/main.c](../src/main.c)**: Generated output file (not source)—produced by compiler

## Build & Test System

### Build Commands

- **Build compiler**: `./scripts/build.ps1` → Compiles `exec.c` + `common.c` → `./dist/tuffc.exe`
- **Test suite**: `./scripts/test.ps1` → Compiles test harness + `common.c` → Runs `./dist/test.exe`
- **Run end-to-end**: `./scripts/run.ps1` → Builds compiler, runs `tuffc.exe` to process `main.tuff`, generates `main.h`/`main.c`

### Tuff Language Features (Implemented)

The compiler currently supports:

- **Variable Declaration**: `let x = expr;` or `let x: TypeName = expr;`
- **Integer Literals**: `0`, `42`, `999`, etc.
- **Identifiers**: User-defined variables and `__args__` special cases
- **Addition Operator**: `expr + expr` (chains allowed: `a + b + c`)
- **Command-line Arguments**:
  - `__args__.length` → returns `argc - 1` (count of actual arguments)
  - `__args__[index].length` → returns strlen of argument at index
- **Implicit Return**: Final expression becomes `return expr;`
- **Error Messages**: Rich diagnostics with reasoning and fix suggestions

### Test Framework ([../tests/test.c](../tests/test.c))

Functional assertion framework with **full binary execution support**:

- `assertValid(testName, source, expectedExitCode, argc, argv)`:
  - Compiles source → generates temp files → invokes clang → executes binary → captures exit code
  - Verifies exit code matches expected value
- `assertInvalid(testName, source)`:
  - Compiles source, verifies compilation error (not output)
- Global counters: `passingTests`, `totalTests` → summary to stderr
- **Binary execution fully implemented**: temp file creation, clang invocation, process execution via `system()` calls

## Coding Conventions

### Memory & Resource Management

- **Manual allocation**: Use `malloc()` for dynamic memory; **always** check return value before dereferencing
- **File I/O**: Pair every `fopen()` with `fclose()`. Follow the pattern in [../src/exec.c](../src/exec.c):
  ```c
  FILE *f = safe_fopen(path, mode);
  if (!f) { fprintf(stderr, "..."); return error; }
  // ... operations ...
  fclose(f);
  ```
- **Error propagation**: Return immediately on resource allocation failure; don't cascade errors
- **Platform-safe I/O**: Use `safe_fopen()` wrapper (defined in [../src/common.c](../src/common.c)) for MSVC/Windows compatibility

### Integer Types

Use fixed-width types exclusively:

- `int32_t` for function return codes and counters
- `size_t` for byte counts
- `char *` for strings (null-terminated)

### Error Handling (No Exceptions)

- **Pattern**: Enum-based result types (`CompileResult`), never C exceptions
- **Exit codes**: Return 0 for success, 1 for errors
- **Error output**: Use `fprintf(stderr, ...)` for all error messages and diagnostics
- **Compiler errors**: Return `CompileError` variant with `erroneous_code`, `error_message`, `reasoning`, `fix` fields for user guidance

### Strings & Buffers

- Always null-terminate manually: `source[source_size] = '\0'`
- Use `strlen()` for length checking before writes
- Validate buffer sizes: Check `MAX_EXPR_LEN` (512), `MAX_SYMBOLS` (64), `MAX_SYMBOL_NAME` (64)
- Use `snprintf()` for safe string formatting (never `sprintf()`)

## Key Files & Responsibilities

| File                               | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| [../src/exec.c](../src/exec.c)     | **Compiler entry point**: file I/O, orchestration, error handling             |
| [../src/common.h](../src/common.h) | Type definitions, `CompileResult` union, `safe_fopen()` declaration           |
| [../src/common.c](../src/common.c) | **Full compiler implementation**: lexing, parsing, semantic analysis, codegen |
| [../tests/test.c](../tests/test.c) | Test harness with binary execution support                                    |
| [../scripts/](../scripts/)         | Build/test PowerShell automation                                              |

## Common Tasks

### Adding a New Language Feature

1. Update `CompileResult` or add helper types in [../src/common.h](../src/common.h) if needed
2. Implement parsing/code-gen logic in [../src/common.c](../src/common.c):
   - Add term parsing in `translate_term()` for simple values
   - Add expression handling in `translate_expression()` for operators
   - Add statement parsing in `compile()` for declarations/statements
3. Add test cases to [../tests/test.c](../tests/test.c) using `assertValid()` or `assertInvalid()`
4. Run `./scripts/test.ps1` to verify

### Debugging Compilation Failures

- Check [../src/exec.c](../src/exec.c) stderr output first (file I/O errors vs. compilation errors)
- Examine `CompileError` fields in result: `erroneous_code`, `error_message`, `reasoning`, `fix`
- Test the `compile()` function in isolation via [../tests/test.c](../tests/test.c)

### Extending Test Coverage

- Add new test function in [../tests/test.c](../tests/test.c): `void testFeatureName()`
- Call `assertValid()` or `assertInvalid()` with appropriate inputs
- The test framework automatically compiles generated C code with clang and executes binaries

## Strengths & Current Status

✅ **Fully Functional**:

- Complete lexer/parser with symbol tracking
- Multi-stage semantic analysis with rich error messages
- Term-level and expression-level codegen
- Full test framework with binary execution

⚠️ **Potential Extensions**:

- Expand operators beyond `+` (arithmetic, comparison, logical)
- Add more data types (beyond `int`)
- Implement function declarations
- Add control flow (if, while, for)

## Windows-Specific Notes

- Scripts are PowerShell (`.ps1`)—run directly: `./scripts/build.ps1`
- Use `safe_fopen()` for MSVC compatibility (handles `fopen_s` internally)
- Output binary: `./dist/tuffc.exe`
- File paths may contain spaces; clang commands properly quoted
