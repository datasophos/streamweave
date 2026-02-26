#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT/backend"
unset VIRTUAL_ENV

uv run ruff check app "$@"
uv run ruff format --check app
uv run ty check app
