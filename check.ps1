#!/usr/bin/env pwsh
# check.ps1 - Must pass before ending any task

$ErrorActionPreference = "Stop"

Write-Host "==> Building tests..."
& make test 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Tests did not build." -ForegroundColor Red
    exit 1
}

Write-Host "==> Running tests..."
& ./test.exe 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Tests did not pass." -ForegroundColor Red
    exit 1
}

Write-Host "OK: All checks passed." -ForegroundColor Green
exit 0
