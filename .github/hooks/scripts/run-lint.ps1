bun run lint
if ($LASTEXITCODE -ne 0) {
    Write-Output '{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"Lint failed. Fix lint errors before stopping."}}'
    exit 2
}
