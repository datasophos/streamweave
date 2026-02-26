#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT/frontend"

node_modules/.bin/prettier --check src
node_modules/.bin/eslint src
node_modules/.bin/tsc --noEmit
