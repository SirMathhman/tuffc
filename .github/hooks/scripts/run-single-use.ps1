bun .github/scripts/single-use.ts
if ($LASTEXITCODE -ne 0) {
    Write-Output '{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"Single-use script failed. Fix errors before stopping."}}'
    exit 2
}
