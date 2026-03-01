#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT"
unset VIRTUAL_ENV

CMD="${1:-build}"
shift 2>/dev/null || true

EXTRA_FLAGS=()
if [[ "$CMD" == "serve" ]]; then
  EXTRA_FLAGS+=(--livereload -o)
fi

uv run --project backend python -m mkdocs "$CMD" -f mkdocs.yml "${EXTRA_FLAGS[@]}" "$@"
