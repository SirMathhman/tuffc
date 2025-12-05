# Install the pre-commit hook for this repository on Windows

$GitDir = & git rev-parse --git-dir
$HookDir = Join-Path $GitDir "hooks"
$HookFile = Join-Path $HookDir "pre-commit"
$SharedHook = ".githooks\pre-commit"

# Check if the shared hook exists
if (-not (Test-Path $SharedHook)) {
    Write-Host "Error: $SharedHook not found" -ForegroundColor Red
    exit 1
}

# Create hooks directory if it doesn't exist
if (-not (Test-Path $HookDir)) {
    New-Item -ItemType Directory -Path $HookDir -Force | Out-Null
}

# Copy the shared hook to git hooks directory
Copy-Item -Path $SharedHook -Destination $HookFile -Force
Write-Host "Pre-commit hook installed successfully!" -ForegroundColor Green
Write-Host "Files with > 500 lines will be blocked from commit." -ForegroundColor Green
