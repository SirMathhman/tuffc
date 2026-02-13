cargo test
if (LastExitCode -ne 0) {
    exit 1
}

pmd cpd src --language rust --minimum-tokens 35
cargo clippy
cargo fmt