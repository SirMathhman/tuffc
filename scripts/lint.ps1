$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$patterns = @('*.c', '*.h')
$files = Get-ChildItem -Path $root -Recurse -File -Include $patterns |
Where-Object {
    $_.FullName -notlike '*\build\*' -and
    $_.FullName -notlike '*\.git\*'
} |
Sort-Object FullName

if (-not $files) {
    Write-Host 'No C source files found to lint.'
    exit 0
}

$issues = @()

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName
    $raw = Get-Content -Path $file.FullName -Raw

    for ($index = 0; $index -lt $content.Count; $index++) {
        $lineNumber = $index + 1
        $line = $content[$index]

        if ($line -match "`t") {
            $issues += "{0}:{1} contains a tab character." -f $file.FullName, $lineNumber
        }

        if ($line -match '\s+$') {
            $issues += "{0}:{1} has trailing whitespace." -f $file.FullName, $lineNumber
        }

        if ($line.Length -gt 100) {
            $issues += "{0}:{1} exceeds 100 characters." -f $file.FullName, $lineNumber
        }

        if ($line -match '\bgets\s*\(') {
            $issues += "{0}:{1} uses gets(), which is unsafe." -f $file.FullName, $lineNumber
        }
    }

    if ($raw.Length -gt 0 -and -not $raw.EndsWith("`n")) {
        $issues += "{0}: missing a trailing newline at end of file." -f $file.FullName
    }
}

if ($issues.Count -gt 0) {
    Write-Host 'Lint issues found:'
    $issues | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host ("Lint passed for {0} file(s)." -f $files.Count)