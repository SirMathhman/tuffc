# PreToolUse hook: Block any git commit --no-verify bypass attempt.
# Reads the tool input JSON from stdin and exits 2 (blocking) if the command
# contains --no-verify.

$input = [Console]::In.ReadToEnd()

try {
    $data = $input | ConvertFrom-Json
} catch {
    exit 0
}

$toolName = $data.toolName
if ($toolName -ne "run_in_terminal" -and $toolName -ne "RunTerminalCommand") {
    exit 0
}

$toolInput = if ($data.toolInput) { $data.toolInput } else { $data.input }
$command = if ($toolInput.command) { $toolInput.command } elseif ($toolInput.cmd) { $toolInput.cmd } else { "" }

if ($command -match '--no-verify') {
    $response = @{
        continue   = $false
        stopReason = "Blocked: --no-verify bypasses the pre-commit checks (bun test, lint, single-use, pmd cpd). Fix the underlying issues instead."
    } | ConvertTo-Json -Compress

    Write-Output $response
    exit 2
}

exit 0
