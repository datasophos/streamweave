#!/usr/bin/env bash
# Run the full E2E integration test suite locally.
#
# Spins up the dev stack (core services + samba + S3), waits for seeding to
# complete, runs the integration tests, then tears everything down.
#
# Usage:
#   bash scripts/run-e2e.sh
#
# Prerequisites:
#   - Docker + Docker Compose v2
#   - uv   (https://docs.astral.sh/uv/)
#   - cd backend && uv sync --all-groups

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Admin credentials — must match what the E2E test fixtures expect.
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-adminpassword}"

COMPOSE_FLAGS=(-f docker-compose.yml -f docker-compose.dev.yml)

# Refuse to start if the stack is already up — avoids clobbering a running
# dev environment and avoids reusing a stale dev-seed container.
if docker compose "${COMPOSE_FLAGS[@]}" ps -q 2>/dev/null | grep -q .; then
    echo "ERROR: Dev stack is already running. Stop it first:"
    echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml down"
    exit 1
fi

cleanup() {
    local exit_code=$?
    echo ""
    if [ "$exit_code" != "0" ]; then
        echo "=== Stack logs (last 50 lines per service) ==="
        docker compose "${COMPOSE_FLAGS[@]}" logs --tail=50 2>/dev/null || true
    fi
    echo "=== Tearing down ==="
    docker compose "${COMPOSE_FLAGS[@]}" down --remove-orphans || true
}
trap cleanup EXIT

# ── Start dev stack (skip Caddy and the hot-reload frontend) ─────────────────
echo "=== Building and starting dev stack ==="
docker compose "${COMPOSE_FLAGS[@]}" up -d --build \
    postgres redis prefect-postgres prefect-server \
    mailpit s3-dev instruments-init samba-instruments samba-archive \
    api worker dev-seed

# ── Wait for dev-seed to finish ──────────────────────────────────────────────
# dev-seed starts only after the API is healthy; api waits for Prefect, which
# can take a few minutes to fully start. Poll up to 5 minutes for the container
# to be created, then block on docker wait until it exits.
echo "=== Waiting for dev-seed to complete (up to 5 min) ==="
SEED_CONTAINER=""
for i in $(seq 1 60); do
    SEED_CONTAINER="$(docker compose "${COMPOSE_FLAGS[@]}" ps -q dev-seed 2>/dev/null || true)"
    if [ -n "$SEED_CONTAINER" ]; then
        echo "  dev-seed started: $SEED_CONTAINER"
        break
    fi
    echo "  Waiting for dev-seed to start... ($i/60)"
    sleep 5
done

if [ -z "$SEED_CONTAINER" ]; then
    echo "ERROR: dev-seed container never started after 5 minutes."
    docker compose "${COMPOSE_FLAGS[@]}" logs api
    exit 1
fi

SEED_EXIT="$(docker wait "$SEED_CONTAINER")"
if [ "$SEED_EXIT" != "0" ]; then
    echo "ERROR: dev-seed exited with code $SEED_EXIT"
    docker compose "${COMPOSE_FLAGS[@]}" logs dev-seed
    exit 1
fi
echo "  Seed complete."

# ── Run integration tests ────────────────────────────────────────────────────
echo "=== Running integration tests ==="
cd "$REPO_ROOT/backend"
uv run pytest tests/test_e2e/ -m integration -v \
    --override-ini="addopts=" \
    --junit-xml=e2e-results.xml

echo ""
echo "=== Done ==="
