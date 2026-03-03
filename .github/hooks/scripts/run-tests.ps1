bun test --timeout 1000 --concurrent
if ($LASTEXITCODE -ne 0) {
    Write-Output '{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"Tests failed. Fix failing tests before stopping."}}'
    exit 2
}
