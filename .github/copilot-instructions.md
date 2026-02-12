# Tuff Compiler - AI Coding Instructions

## Project Overview

**Tuff** is a compiler that translates `.tuff` source code into C. The compiler reads a single input file (`main.tuff`), parses/analyzes it, and generates two output files: a C header file (`main.h`) and a C implementation file (`main.c`).

## Architecture & Data Flow

### Core Compilation Pipeline

1. **Entry Point** ([../main.c](../main.c)): Orchestrates the entire pipeline:
   - Reads `main.tuff` from disk with exhaustive error handling
   - Calls `compile(source)` function with entire file contents as string
   - Writes C output files and handles compilation failures gracefully

2. **Compilation Logic** ([../common.c](../common.c)): Contains the `compile()` stub—this is where language-specific parsing and code generation happens (currently TODO)

3. **Type System** ([../common.h](../common.h)): Critical tagged union pattern:
   ```c
   typedef struct {
       enum { OutputVariant, CompileErrorVariant } variant;
       union {
           Output output;           // {headerCCode, targetCCode}
           CompileError error;      // {erroneous_code, error_message, reasoning, fix}
       };
   } CompileResult;
   ```
   **Always** check the `variant` field before accessing union members—never assume success.

### Execution Module

**Note**: [../exec.c](../exec.c) appears identical to [../main.c](../main.c) in current state. Clarify its intended purpose before adding execution-specific logic.

## Build & Test System

### Build Commands

- **Build**: `./scripts/build.ps1` → Compiles `main.c`, `common.c`, `exec.c` → `./dist/tuffc.exe`
- **Test**: `./scripts/test.ps1` → Compiles test suite with `test.c` (not `exec.c`) → Runs `./dist/test.exe`
- **Run**: `./scripts/run.ps1` → Builds then executes compiled program

### Test Framework ([../test.c](../test.c))

Manual assertion approach over a testing library:

- `assertValid(name, source, expectedExitCode, argc, argv)`: Compile source, verify no errors, run binary
- `assertError(name, source)`: Compile source, verify compilation failure
- Global counters: `passingTests`, `totalTests` → Summary printed to stderr
- **TODO**: Actual binary execution logic not implemented

## Coding Conventions

### Memory & Resource Management

- **Manual allocation**: Use `malloc()` for dynamic memory; **always** check return value before dereferencing
- **File I/O**: Pair every `fopen()` with `fclose()`. Follow the pattern in [../main.c](../main.c):
  ```c
  FILE *f = fopen(...);
  if (!f) { fprintf(stderr, "..."); return error; }
  // ... operations ...
  fclose(f);
  ```
- **Error propagation**: Return immediately on resource allocation failure; don't cascade errors

### Integer Types

Use fixed-width types exclusively:

- `int32_t` for function return codes and counters
- `size_t` for byte counts
- `char *` for strings (null-terminated)

### Error Handling (No Exceptions)

- **Pattern**: Enum-based result types, never C exceptions
- **Exit codes**: Return 0 for success, 1 for errors
- **Error output**: Use `fprintf(stderr, ...)` for all error messages and diagnostics
- **Error recovery**: Design functions to fail cleanly with detailed messages (see `CompileError.reasoning` field)

### Strings & Buffers

- Always null-terminate manually when reading files: `source[source_size] = '\0'`
- Use `strlen()` for length when writing file contents
- Avoid buffer overflow: Validate sizes before reads/writes

## Key Files & Responsibilities

| File                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| [../main.c](../main.c)     | **Entry point**: file I/O, orchestration, error handling |
| [../common.h](../common.h) | Type definitions, `CompileResult` union                  |
| [../common.c](../common.c) | `compile()` function implementation (stub)               |
| [../exec.c](../exec.c)     | **Status unclear**—investigate before extending          |
| [../test.c](../test.c)     | Test harness and assertions                              |
| [../scripts/](../scripts/) | Build/test PowerShell automation                         |

## Common Tasks

### Adding a New Language Feature

1. Update `CompileResult` or add helper types in [../common.h](../common.h) if needed
2. Implement parsing/code-gen logic in [../common.c](../common.c)
3. Add test case to [../test.c](../test.c) using `assertValid()` or `assertError()`
4. Run `./scripts/test.ps1` to verify

### Debugging Compilation Failures

- Check [../main.c](../main.c) stderr output first (file I/O errors vs. compilation errors)
- Examine `CompileError` fields in result: `erroneous_code`, `error_message`, `reasoning`, `fix`
- Test the `compile()` function in isolation via [../test.c](../test.c)

### Extending Test Coverage

- Add new test function in [../test.c](../test.c): `void testFeatureName()`
- Call `assertValid()` or `assertError()` with appropriate inputs
- **TODO**: Implement binary execution in `assertValid()` to complete the test loop

## Active TODOs & Gaps

1. **[../common.c](../common.c)**: `compile()` function body—stub returns placeholder
2. **[../test.c](../test.c)**: Binary execution (`actualExitCode = -1` hardcoded)—needs temp file creation, clang invocation, execution
3. **[../exec.c](../exec.c)**: Purpose/differences from [../main.c](../main.c) unclear—needs investigation
4. **Documentation**: No README—add once project stabilizes

## Windows-Specific Notes

- Scripts are PowerShell (`.ps1`)—run directly: `./scripts/build.ps1`
- Output binary: `./dist/tuffc.exe`
- File paths may contain spaces; always quote in clang commands
