pmd cpd src --language typescript --minimum-tokens 35 --format markdown
if ($LASTEXITCODE -ne 0) {
  Write-Host "Duplicate code detected in TypeScript files. Please review the report above."
  exit 1
}

pmd cpd src --language cpp --minimum-tokens 35 --format markdown
if ($LASTEXITCODE -ne 0) {
  Write-Host "Duplicate code detected in C files. Please review the report above."
  exit 1
}