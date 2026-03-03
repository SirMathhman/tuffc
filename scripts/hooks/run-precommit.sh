#!/usr/bin/env bash
# Stop hook: run precommit checks and block session end if they fail

set -euo pipefail

failed=false
failed_checks=()

run_check() {
    local label="$1"
    shift
    if ! "$@" > /dev/null 2>&1; then
        failed=true
        failed_checks+=("$label")
    fi
}

run_check "bun test" bun test --timeout 5000 --concurrent
run_check "bun run lint" bun run lint
run_check "bun scripts/single-use.ts" bun scripts/single-use.ts
run_check "pmd cpd" pmd cpd index.ts --language typescript --minimum-tokens 35

if [ "$failed" = true ]; then
    list=$(IFS=", "; echo "${failed_checks[*]}")
    printf '{"stopReason":"Pre-commit checks failed: %s. Fix these before finishing the session."}\n' "$list"
    exit 2
fi

exit 0
