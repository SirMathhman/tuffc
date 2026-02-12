./scripts/test.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

./scripts/cpd.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

./scripts/scan-duplicate-string-subsets.ps1 -Paths @("./src/*.c") -MinimumLength 21
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }