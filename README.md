# StreamWeave

<p align="center">
    <img src="https://raw.githubusercontent.com/datasophos/streamweave/main/_streamweave.png" width="300">
</p>

StreamWeave is a scientific instrument data harvesting and management system. 

StreamWeave periodically pulls data from CIFS/SMB shares on scientific instruments via service accounts and delivers it to configured storage destinations (POSIX, S3, NFS, CIFS), with persistent file identifiers, full transfer audit trails, and a configurable hook system for integration with external APIs.

## Architecture

| Component | Technology |
|---|---|
| API Backend | FastAPI + SQLAlchemy 2.0 + Alembic |
| Auth | fastapi-users (local accounts; OAuth2/OIDC planned) |
| Database | PostgreSQL (SQLite for dev/small deployments) |
| Orchestration | Prefect (self-hosted server + workers) |
| Default Transfer | rclone (pluggable: Globus, rsync) |
| Frontend | React + Vite + TanStack Query |
| Identifiers | ARK (configurable DOI/Handle) |
| Credential Storage | Fernet encryption at rest |
| Deployment | Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ and [uv](https://docs.astral.sh/uv/) (for local development)

### Run with Docker

```bash
cp .env.example .env
# Edit .env with your secrets (especially STREAMWEAVE_ENCRYPTION_KEY and SECRET_KEY)
docker compose up
```

The API will be available at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

### Local Development

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

### Simulated Laboratory

Spin up 3 simulated instrument Samba shares for integration testing:

```bash
docker compose -f simlab/docker-compose.simlab.yml up
```

Then seed the database with matching instrument configurations:

```bash
cd simlab
python seed.py
```

### Create Admin User

```bash
cd backend
python ../scripts/create-admin.py
```

### Run Tests

```bash
cd backend
pytest
```

## Project Structure

```
streamweave/
├── docker-compose.yml          # PostgreSQL + API
├── docker-compose.dev.yml      # Dev overrides (hot reload)
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/                # Database migrations
│   └── app/
│       ├── main.py             # FastAPI application
│       ├── config.py           # Pydantic Settings
│       ├── database.py         # Async SQLAlchemy engine
│       ├── models/             # SQLAlchemy models
│       ├── schemas/            # Pydantic request/response models
│       ├── api/                # REST API endpoints
│       ├── services/           # Business logic (credentials, identifiers)
│       └── auth/               # fastapi-users configuration
├── tests/                      # pytest test suite
├── simlab/                     # Simulated laboratory for integration testing
│   ├── docker-compose.simlab.yml
│   ├── seed.py
│   └── instruments/            # Sample data per instrument
└── scripts/
    └── create-admin.py
```

## API Endpoints

All resource endpoints require authentication. Admin role required for management operations.

| Endpoint | Description |
|---|---|
| `POST /auth/register` | Register a new user |
| `POST /auth/jwt/login` | Get JWT access token |
| `/api/instruments` | CRUD for instruments |
| `/api/storage-locations` | CRUD for storage destinations |
| `/api/service-accounts` | CRUD for CIFS service accounts |
| `/api/schedules` | CRUD for harvest schedules |
| `/api/hooks` | CRUD for hook configurations |
| `/users/me` | Current user profile |
| `/health` | Health check |

## License

MIT
