pmd cpd index.ts --language typescript --minimum-tokens 35
if ($LASTEXITCODE -ne 0) {
    Write-Output '{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"CPD check failed. Fix code duplication before stopping."}}'
    exit 2
}
