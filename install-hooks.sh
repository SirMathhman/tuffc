#!/bin/bash
# Install the pre-commit hook for this repository

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

# Get the path to the shared hook in .githooks/
SHARED_HOOK=".githooks/pre-commit"

# Check if the shared hook exists
if [ ! -f "$SHARED_HOOK" ]; then
    echo "Error: $SHARED_HOOK not found"
    exit 1
fi

# Copy the shared hook to git hooks directory
mkdir -p "$HOOK_DIR"
cp "$SHARED_HOOK" "$HOOK_FILE"
chmod +x "$HOOK_FILE"

echo "Pre-commit hook installed successfully!"
echo "Files with > 500 lines will be blocked from commit."
