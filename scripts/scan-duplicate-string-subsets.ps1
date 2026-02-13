param(
    [Parameter(Mandatory = $false)]
    [string[]]$Paths = @("./src/*.c", "./src/*.h", "./tests/*.c"),

    [Parameter(Mandatory = $false)]
    [int]$MinimumLength = 21
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-CStringLiterals {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $literals = New-Object System.Collections.Generic.List[object]

    $state = "Code" # Code | LineComment | BlockComment | String | Char
    $line = 1
    $column = 1
    $i = 0
    $length = $Content.Length

    while ($i -lt $length) {
        $ch = $Content[$i]
        $next = if ($i + 1 -lt $length) { $Content[$i + 1] } else { [char]0 }

        if ($state -eq "Code") {
            if ($ch -eq '/' -and $next -eq '/') {
                $state = "LineComment"
                $i += 2
                $column += 2
                continue
            }

            if ($ch -eq '/' -and $next -eq '*') {
                $state = "BlockComment"
                $i += 2
                $column += 2
                continue
            }

            if ($ch -eq '"') {
                $startLine = $line
                $startColumn = $column
                $builder = New-Object System.Text.StringBuilder

                $i++
                $column++

                while ($i -lt $length) {
                    $sch = $Content[$i]

                    if ($sch -eq '\\') {
                        if ($i + 1 -lt $length) {
                            [void]$builder.Append($sch)
                            [void]$builder.Append($Content[$i + 1])
                            $i += 2
                            $column += 2
                            continue
                        }
                        else {
                            [void]$builder.Append($sch)
                            $i++
                            $column++
                            break
                        }
                    }

                    if ($sch -eq '"') {
                        $i++
                        $column++

                        $literals.Add([PSCustomObject]@{
                                Text   = $builder.ToString()
                                Line   = $startLine
                                Column = $startColumn
                            })
                        break
                    }

                    [void]$builder.Append($sch)

                    if ($sch -eq "`n") {
                        $line++
                        $column = 1
                    }
                    else {
                        $column++
                    }

                    $i++
                }

                continue
            }

            if ($ch -eq "'") {
                $state = "Char"
                $i++
                $column++
                continue
            }
        }
        elseif ($state -eq "LineComment") {
            if ($ch -eq "`n") {
                $state = "Code"
            }
        }
        elseif ($state -eq "BlockComment") {
            if ($ch -eq '*' -and $next -eq '/') {
                $state = "Code"
                $i += 2
                $column += 2
                continue
            }
        }
        elseif ($state -eq "Char") {
            if ($ch -eq '\\') {
                $i += 2
                $column += 2
                continue
            }

            if ($ch -eq "'") {
                $state = "Code"
            }
        }

        if ($ch -eq "`n") {
            $line++
            $column = 1
        }
        else {
            $column++
        }

        $i++
    }

    return $literals
}

function Get-LongestCommonSubstring {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$A,
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$B
    )

    if ([string]::IsNullOrEmpty($A) -or [string]::IsNullOrEmpty($B)) {
        return ""
    }

    $m = $A.Length
    $n = $B.Length
    $previous = New-Object int[] ($n + 1)
    $current = New-Object int[] ($n + 1)

    $maxLength = 0
    $endIndexInA = 0

    for ($i = 1; $i -le $m; $i++) {
        for ($j = 1; $j -le $n; $j++) {
            if ($A[$i - 1] -eq $B[$j - 1]) {
                $current[$j] = $previous[$j - 1] + 1
                if ($current[$j] -gt $maxLength) {
                    $maxLength = $current[$j]
                    $endIndexInA = $i
                }
            }
            else {
                $current[$j] = 0
            }
        }

        $tmp = $previous
        $previous = $current
        $current = $tmp
        [Array]::Clear($current, 0, $current.Length)
    }

    if ($maxLength -eq 0) {
        return ""
    }

    return $A.Substring($endIndexInA - $maxLength, $maxLength)
}

function Format-Preview {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $preview = $Text.Replace("`r", "\\r").Replace("`n", "\\n").Replace("`t", "\\t")
    if ($preview.Length -gt 120) {
        return $preview.Substring(0, 120) + "..."
    }

    return $preview
}

function Resolve-InputFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$FilePatterns
    )

    $resolved = New-Object System.Collections.Generic.List[string]
    foreach ($pattern in $FilePatterns) {
        $items = Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            $resolved.Add($item.FullName)
        }
    }

    return @($resolved | Sort-Object -Unique)
}

$files = Resolve-InputFiles -FilePatterns $Paths
if ((@($files)).Count -eq 0) {
    Write-Host "No matching C files found to scan."
    exit 0
}

$foundAnyDuplicate = $false

foreach ($file in $files) {
    $content = Get-Content -Path $file -Raw
    $literals = @(Get-CStringLiterals -Content $content)

    if ($literals.Count -lt 2) {
        continue
    }

    for ($i = 0; $i -lt $literals.Count - 1; $i++) {
        for ($j = $i + 1; $j -lt $literals.Count; $j++) {
            $a = $literals[$i]
            $b = $literals[$j]

            $dup = Get-LongestCommonSubstring -A $a.Text -B $b.Text
            if ($dup.Length -ge $MinimumLength) {
                $foundAnyDuplicate = $true
                Write-Host "Duplicate string subset found in $file"
                Write-Host "  line $($a.Line) and line $($b.Line), length $($dup.Length)"
                Write-Host "  `"$(Format-Preview -Text $dup)`""
                Write-Host "  -> You MUST extract this as a constant (local or global)"
            }
        }
    }
}

if ($foundAnyDuplicate) {
    exit 1
}

Write-Host "No duplicate string subsets longer than $($MinimumLength - 1) characters were found."
exit 0