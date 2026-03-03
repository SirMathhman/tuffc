#!/usr/bin/env pwsh
# Stop hook: run precommit checks and block session end if they fail

$ErrorActionPreference = "Stop"

$checks = @(
    @{ label = "bun test"; cmd = "bun"; args = @("test", "--timeout", "5000", "--concurrent") },
    @{ label = "bun run lint"; cmd = "bun"; args = @("run", "lint") },
    @{ label = "bun scripts\single-use.ts"; cmd = "bun"; args = @("scripts\single-use.ts") },
    @{ label = "pmd cpd"; cmd = "pmd"; args = @("cpd", "index.ts", "--language", "typescript", "--minimum-tokens", "35") }
)

$failed = $false
$failedChecks = @()

foreach ($check in $checks) {
    & $check.cmd @($check.args) 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $failed = $true
        $failedChecks += $check.label
    }
}

if ($failed) {
    $list = $failedChecks -join ", "
    $output = @{
        stopReason = "Pre-commit checks failed: $list. Fix these before finishing the session."
    } | ConvertTo-Json -Compress
    Write-Output $output
    exit 2
}

exit 0
