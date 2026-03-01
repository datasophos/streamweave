#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT"
bash scripts/test_backend.sh

cd "$REPO_ROOT"
bash scripts/test_frontend.sh
