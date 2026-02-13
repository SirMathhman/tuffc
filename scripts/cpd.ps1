pmd cpd src --language cpp --minimum-tokens 35 --ignore-literals --ignore-identifiers;
if ($LASTEXITCODE -ne 0) {
    Write-Error "Duplicate code was detected by PMD CPD. The duplicate to extract depends on what's in it. If it's mostly statements, extract a function. If it's mostly declarations, extract a structure."
    exit 1
}