# Quick Start

## Prerequisites

- Docker & Docker Compose
- Python 3.11+ and [uv](https://docs.astral.sh/uv/) (for local development)

## Run with Docker

```bash
cp .env.example .env
# Edit .env with your secrets (especially STREAMWEAVE_ENCRYPTION_KEY and SECRET_KEY)
docker compose up
```

The API will be available at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

The Prefect UI will be available at `http://localhost:4200`.

## Services

The full Docker Compose stack starts:

| Service | Port | Description |
|---|---|---|
| `api` | 8000 | Streamweave FastAPI backend |
| `postgres` | 5432 | Application database |
| `redis` | 6379 | Prefect cache |
| `prefect-server` | 4200 | Prefect UI and API |
| `prefect-postgres` | — | Prefect's internal database |
| `worker` | — | Prefect worker with rclone installed |

## Create an Admin User

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://streamweave:streamweave@localhost:5432/streamweave \
  python ../scripts/create-admin.py
```

!!! note
    The script prompts for email and password interactively. It must be run from the host machine with the backend virtualenv active.

## Get an Auth Token

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/jwt/login \
  -d "username=admin@test.org&password=yourpassword" \
  | jq -r '.access_token')

AUTH="Authorization: Bearer $TOKEN"
```

## Local Development

```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"

# Run migrations (requires DATABASE_URL in .env or environment)
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload
```

## Run Tests

```bash
cd backend
pytest
```

Tests use an in-memory SQLite database and don't require Docker.
