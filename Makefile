.PHONY: test e2e lint dup-check check-all

test:
	cargo test

e2e:
	cargo test --test e2e_cli

lint:
	cargo fmt --all -- --check
	cargo clippy --all-targets --all-features -- -D warnings

dup-check:
	pmd cpd --minimum-tokens 40 --language rust --dir src --dir tests

check-all: lint test dup-check
