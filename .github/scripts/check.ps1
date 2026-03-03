# Validation check: tests and linter
# Runs on agent session stop to ensure code quality before completion

param(
    [int]$TestTimeout = 1000,
    [int]$LintTimeout = 30
)

Write-Host "Running validation checks..." -ForegroundColor Cyan

# Run tests
Write-Host "1. Running tests..." -ForegroundColor Yellow
bun test --timeout $TestTimeout --concurrent
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Tests failed" -ForegroundColor Red
    exit 2
}
Write-Host "PASSED: Tests passed" -ForegroundColor Green

# Run linter
Write-Host "2. Running linter..." -ForegroundColor Yellow
bun run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Linting failed" -ForegroundColor Red
    exit 2
}
Write-Host "PASSED: Linting passed" -ForegroundColor Green

# Run single-use check
Write-Host "3. Checking for single-use declarations..." -ForegroundColor Yellow
bun .github/scripts/single-use.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Single-use declarations found" -ForegroundColor Red
    exit 2
}
Write-Host "PASSED: No single-use declarations" -ForegroundColor Green

# Run PMD copy-paste detector
Write-Host "4. Checking for duplicate code..." -ForegroundColor Yellow
pmd cpd index.ts --language typescript --minimum-tokens 35
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Duplicate code detected" -ForegroundColor Red
    exit 2
}
Write-Host "PASSED: No duplicate code detected" -ForegroundColor Green

Write-Host "PASSED: All checks passed" -ForegroundColor Green
exit 0
