#!/usr/bin/env pwsh
# find-duplicate-substrings.ps1
# Scans string literals in /src and reports substrings shared between two or more literals.
# Exit code 1 if any duplicates are found above the minimum length threshold.

param(
    [int]$MinLength = 2
)

$srcDir = Join-Path $PSScriptRoot "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.cpp", "*.c", "*.h"

# Extract all string literals with their source location
# Handles simple escaped quotes (\") but not raw strings
$literals = [System.Collections.Generic.List[hashtable]]::new()
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $regex = [regex]'"((?:[^"\\]|\\.)*)"'
    foreach ($m in $regex.Matches($content)) {
        $val = $m.Groups[1].Value
        if ($val.Length -ge $MinLength) {
            $literals.Add(@{ Value = $val; File = $file.Name })
        }
    }
}

Write-Host "Scanning $($literals.Count) string literals (min length: $MinLength) across $($files.Count) file(s)..."

# Check if a substring breaks up a word in a given string
function Is-BreakingUpWord {
    param([string]$str, [string]$substring)
    $idx = $str.IndexOf($substring)
    if ($idx -lt 0) { return $false }
    
    # Check left character
    $hasAlphanumericLeft = ($idx -gt 0) -and ($str[$idx - 1] -match '[a-zA-Z0-9]')
    # Check right character
    $hasAlphanumericRight = ($idx + $substring.Length -lt $str.Length) -and ($str[$idx + $substring.Length] -match '[a-zA-Z0-9]')
    
    # Breaking up a word means alphanumeric on either side
    return $hasAlphanumericLeft -or $hasAlphanumericRight
}

# For each pair of literals, find their longest common substrings
function Get-CommonSubstrings {
    param([string]$a, [string]$b, [int]$minLen)
    $found = [System.Collections.Generic.HashSet[string]]::new()
    for ($i = 0; $i -le $a.Length - $minLen; $i++) {
        for ($len = $minLen; $i + $len -le $a.Length; $len++) {
            $sub = $a.Substring($i, $len)
            if ($b.Contains($sub)) {
                # Only add if it doesn't break up words in either string
                $breaksInA = Is-BreakingUpWord -str $a -substring $sub
                $breaksInB = Is-BreakingUpWord -str $b -substring $sub
                if (-not ($breaksInA -or $breaksInB)) {
                    $found.Add($sub) | Out-Null
                }
            }
        }
    }
    # Return only maximal substrings (not substrings of other found substrings)
    $maximal = $found | Where-Object { $s = $_; -not ($found | Where-Object { $_ -ne $s -and $_.Contains($s) }) }
    return $maximal
}

$violations = [System.Collections.Generic.List[hashtable]]::new()
for ($i = 0; $i -lt $literals.Count; $i++) {
    for ($j = $i + 1; $j -lt $literals.Count; $j++) {
        $a = $literals[$i]
        $b = $literals[$j]
        if ($a.Value -eq $b.Value) { continue } # exact duplicates are a separate concern
        $common = Get-CommonSubstrings -a $a.Value -b $b.Value -minLen $MinLength
        foreach ($sub in $common) {
            $violations.Add(@{
                Sub    = $sub
                FileA  = $a.File
                LitA   = $a.Value
                FileB  = $b.File
                LitB   = $b.Value
            })
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "OK: No duplicate substrings found." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "FAIL: Found $($violations.Count) duplicate substring(s) across string literals:" -ForegroundColor Red
foreach ($v in $violations | Sort-Object { $_.Sub.Length } -Descending) {
    Write-Host ""
    Write-Host "  Duplicate: `"$($v.Sub)`"" -ForegroundColor Yellow
    Write-Host "    in [$($v.FileA)]: `"$($v.LitA)`""
    Write-Host "    in [$($v.FileB)]: `"$($v.LitB)`""
}
exit 1
