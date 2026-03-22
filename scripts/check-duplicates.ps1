$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$windowSize = 5
$sourceFiles = Get-ChildItem -Path $root -Recurse -File -Include '*.c', '*.h' |
Where-Object {
    $_.FullName -notlike '*\build\*' -and
    $_.FullName -notlike '*\.git\*'
} |
Sort-Object FullName

if (-not $sourceFiles) {
    Write-Host 'No C source files found to inspect for duplication.'
    exit 0
}

$windows = @{}

foreach ($file in $sourceFiles) {
    $content = Get-Content -Path $file.FullName
    $normalizedLines = @()

    for ($index = 0; $index -lt $content.Count; $index++) {
        $line = ($content[$index] -replace '//.*$', '').Trim()

        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $normalizedLines += [pscustomobject]@{
            Text       = $line
            LineNumber = $index + 1
        }
    }

    for ($start = 0; $start -le $normalizedLines.Count - $windowSize; $start++) {
        $slice = $normalizedLines[$start..($start + $windowSize - 1)]
        $key = ($slice.Text -join "`n")

        if (-not $windows.ContainsKey($key)) {
            $windows[$key] = @()
        }

        $windows[$key] += [pscustomobject]@{
            File      = $file.FullName
            StartLine = $slice[0].LineNumber
            EndLine   = $slice[-1].LineNumber
        }
    }
}

$duplicates = $windows.GetEnumerator() |
Where-Object { $_.Value.Count -gt 1 } |
Sort-Object { $_.Value.Count } -Descending

if (-not $duplicates) {
    Write-Host 'No duplicate 5-line code windows were found.'
    exit 0
}

Write-Host 'Duplicate code windows found:'

foreach ($duplicate in $duplicates) {
    Write-Host '---'
    Write-Host $duplicate.Key

    foreach ($location in $duplicate.Value) {
        Write-Host ("  {0}:{1}-{2}" -f $location.File, $location.StartLine, $location.EndLine)
    }
}

exit 1