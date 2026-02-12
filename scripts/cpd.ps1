pmd cpd src --language cpp --minimum-tokens 35 --ignore-literals --ignore-identifiers;
./scripts/scan-duplicate-string-subsets.ps1 -Paths @("./src/*.c", "./src/*.h", "./tests/*.c") -MinimumLength 21;