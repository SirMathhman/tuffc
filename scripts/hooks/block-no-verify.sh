#!/bin/bash
# PreToolUse hook: Block any git commit --no-verify bypass attempt.
# Reads the tool input JSON from stdin and exits 2 (blocking) if the command
# contains --no-verify.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('toolName',''))" 2>/dev/null)

if [ "$TOOL_NAME" != "run_in_terminal" ] && [ "$TOOL_NAME" != "RunTerminalCommand" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('toolInput', d.get('input', {}))
print(inp.get('command', inp.get('cmd', '')))
" 2>/dev/null)

if echo "$COMMAND" | grep -q -- '--no-verify'; then
  echo '{"continue": false, "stopReason": "Blocked: --no-verify bypasses the pre-commit checks (bun test, lint, single-use, pmd cpd). Fix the underlying issues instead."}' 
  exit 2
fi

exit 0
