#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT/backend"
unset VIRTUAL_ENV

CMD="${1:-build}"
shift 2>/dev/null || true

EXTRA_ARGS=()
if [ "$CMD" = "serve" ]; then
  EXTRA_ARGS+=(--watch "$REPO_ROOT/docs")
fi

uv run python -m mkdocs "$CMD" -f ../mkdocs.yml "${EXTRA_ARGS[@]}" "$@"
