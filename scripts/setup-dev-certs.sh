#!/usr/bin/env bash
# Generates a local HTTPS certificate for streamweave.local using mkcert.
# Run this once per machine before starting the dev stack.
#
# Usage:
#   bash scripts/setup-dev-certs.sh
#
# Windows users: install mkcert via Chocolatey or Scoop and run the two
# mkcert commands manually — see docs/getting-started/development.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$REPO_ROOT/caddy/certs"

if ! command -v mkcert &>/dev/null; then
    echo "Error: mkcert is not installed." >&2
    echo "" >&2
    echo "Install it with:" >&2
    echo "  macOS:   brew install mkcert" >&2
    echo "  Linux:   https://github.com/FiloSottile/mkcert#linux" >&2
    echo "  Windows: scoop install mkcert  (or choco install mkcert)" >&2
    exit 1
fi

echo "==> Installing mkcert root CA into system trust store..."
mkcert -install

echo "==> Generating certificate for streamweave.local..."
mkdir -p "$CERT_DIR"
mkcert \
    -cert-file "$CERT_DIR/streamweave.local.crt" \
    -key-file  "$CERT_DIR/streamweave.local.key" \
    streamweave.local

CAROOT="$(mkcert -CAROOT)"
echo "==> Copying mkcert root CA ($CAROOT/rootCA.pem) for use by httpx clients..."
cp "$CAROOT/rootCA.pem" "$CERT_DIR/rootCA.pem"

echo ""
echo "Done! Certs written to caddy/certs/."
echo ""
echo "Start the dev stack with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml up"
