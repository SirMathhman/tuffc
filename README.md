# tuffc

A minimal Rust project scaffolded with:

- a sample end-to-end test,
- duplicate code detection via PMD CPD,
- and a simple lint setup.

## Requirements

- Rust toolchain (`cargo`, `rustfmt`, `clippy`)
- PMD with `pmd` available in `PATH`

## Run checks

- Run tests: `cargo test`
- Run only e2e test: `cargo test --test e2e_cli`
- Run lints: `make lint`
- Run duplicate check: `make dup-check`
- Run all checks: `make check-all`

## PMD CPD

This project uses:

`pmd cpd --minimum-tokens 40 --language rust --dir src --dir tests`

You can customize behavior in `.pmd-cpd.properties`.
