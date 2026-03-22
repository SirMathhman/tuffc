# tuffc

A small starter C project with:

- a `CMake` build
- a sample end-to-end test powered by `CTest`
- a lightweight lint script
- a duplicate-code checker

## Project layout

- `src/` - application code
- `include/` - public headers
- `tests/` - end-to-end test scripts
- `scripts/` - repository quality checks
- `.vscode/tasks.json` - one-click editor tasks

## Requirements

- `CMake` 3.20 or newer
- a C compiler such as MSVC, Clang, or GCC
- `PowerShell` 7+ for the helper scripts

## Quick start

1. Configure the project.
2. Build it with the `Debug` configuration.
3. Run the test suite against the `Debug` build.
4. Run the lint and duplicate checks.

If you are using VS Code, run the `verify` task to execute the full flow.

## Sample app usage

After building, run the generated executable with:

- `tuffc greet Copilot`

Expected output:

- `Hello, Copilot!`

## Quality checks

- `scripts/lint.ps1` flags tabs, trailing whitespace, overlong lines, unsafe `gets()`, and missing final newlines.
- `scripts/check-duplicates.ps1` reports repeated 5-line code windows across `.c` and `.h` files.

They are intentionally simple, easy to tweak, and dependency-free.
