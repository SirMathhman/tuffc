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

Write-Host "==> Checking for disallowed string formatting (sprintf/snprintf)..."
$formatMatches = @()
Get-ChildItem -Path src -Include *.c, *.cpp, *.h, *.hpp -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    # Look for sprintf/snprintf calls (not in comments)
    $lines = Get-Content $_.FullName
    $lineNumber = 0
    foreach ($line in $lines) {
        $lineNumber++
        # Skip comments
        if ($line -match '^\s*//') { continue }
        # Check for sprintf or snprintf usage (not just in strings)
        if (($line -match '\bsprintf\s*\(' -or $line -match '\bsnprintf\s*\(') -and $line -notmatch '^\s*\*') {
            $formatMatches += "$($_.FullName):$lineNumber`:`  $line"
        }
    }
}

if ($formatMatches.Count -gt 0) {
    Write-Host "FAILED: String formatting usage found (sprintf/snprintf):" -ForegroundColor Red
    $formatMatches | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host "==> Checking for duplicate code (PMD CPD)..."
& pmd cpd --dir src --language cpp --minimum-tokens 40 --ignore-identifiers 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: PMD CPD found duplicate code." -ForegroundColor Red
    exit 1
}

Write-Host "==> Checking for duplicate string substrings..."
& pwsh find-duplicate-substrings.ps1 -MinLength 4 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: Duplicate string substrings found." -ForegroundColor Red
    exit 1
}

Write-Host "OK: All checks passed." -ForegroundColor Green
exit 0
