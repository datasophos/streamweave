#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT/frontend"

node_modules/.bin/prettier --write 'src/**/*.{ts,tsx}'
node_modules/.bin/eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
node_modules/.bin/tsc --noEmit
