cargo test
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

pmd cpd src --language rust --minimum-tokens 35
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

cargo clippy
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

cargo fmt
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
