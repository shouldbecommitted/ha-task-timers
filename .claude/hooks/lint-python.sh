#!/usr/bin/env bash
# PostToolUse hook: auto-format and lint Python files after Edit/Write.
#
# Stdin: JSON object from Claude Code with keys tool_name and tool_input.
# Only runs on .py files; exits 0 silently for everything else.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$REPO_DIR/.claude/lint-venv"

# Parse the file path from the tool input JSON on stdin.
FILE=$(python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null || true)

# Nothing to do for non-Python files.
[[ -z "$FILE" || "$FILE" != *.py ]] && exit 0

# Bootstrap lint venv on first use (takes ~10 s once, then cached).
if [[ ! -x "$VENV/bin/black" ]]; then
    echo "[lint-python] Setting up lint venv (first run)..." >&2
    python3 -m venv "$VENV"
    # Extract pinned black + flake8 lines from requirements-dev.txt.
    PKGS=$(python3 -c "
import re, pathlib
lines = pathlib.Path('$REPO_DIR/requirements-dev.txt').read_text().splitlines()
print(' '.join(l.strip() for l in lines if re.match(r'^(black|flake8)[=><!]', l.strip())))
")
    "$VENV/bin/pip" install --quiet $PKGS
fi

echo "[lint-python] $FILE" >&2

# Black formats in-place (idempotent — no diff means no change).
"$VENV/bin/black" --quiet "$FILE"

# Flake8 only reports; non-zero exit prints the issues to stderr.
"$VENV/bin/flake8" "$FILE" \
    --max-line-length=100 \
    --ignore=E203,E501,W503
