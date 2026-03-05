.PHONY: test dedup check stop help

# Default target
help:
	@echo Tuffc build targets:
	@echo   make test     - Build and run tests (compiles using clang)
	@echo   make dedup    - Run code duplication detection (CPD)
	@echo   make check    - Run all checks (test + dedup)
	@echo   make stop     - Alias for check (matches original hook behavior)

# Build and run tests
test:
	@echo Building test executable...
	clang -Werror test.c execute.c compile.c -o test.exe
	@echo Running tests...
	./test.exe

# Run code duplication detection
dedup:
	pmd cpd . --language cpp --minimum-tokens 35 --ignore-literals --ignore-identifiers || exit 2

# Run all checks
check: test dedup
	@echo All checks passed!

# Alias for check (matches the original "Stop" hook)
stop: check
