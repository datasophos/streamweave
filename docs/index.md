<div style="text-align:center;padding:2rem 0 0.5rem;">
  <img src="_static/streamweave_logo.svg" alt="StreamWeave logo" width="180" style="margin-bottom:0.75rem;">
  <h1 style="font-size:2.5rem;margin:0 0 0.5rem;">StreamWeave</h1>
  <p style="font-size:0.7rem;opacity:0.75;margin:0 0 1rem;"><em>Scientific data harvesting, simplified.</em></p>
</div>

!!! warning "Pre-Alpha Software"
    StreamWeave is under heavy active development and not yet ready for production use. Prior to version 1.0, APIs, data models, and configuration formats are likely to change without notice.

StreamWeave tames unruly streams of scientific data by automatically pulling files from scientific instruments via service accounts and delivers them to configured storage destinations (POSIX, S3, NFS, CIFS), with persistent file identifiers, configurable destination and access control, full transfer audit trails, and an easily extensible hook system for integration with external APIs.

## Key Features

- **Automated harvesting** — Prefect-orchestrated workflows discover and transfer new files on a cron schedule
- **Persistent identifiers** — Every file receives a unique ARK identifier for long-term tracking
- **Transfer auditing** — Full audit trail with checksums, timestamps, and byte counts for every file transfer
- **Hook system** — Configurable pre-transfer (file filtering, redirect) and post-transfer (metadata enrichment) hooks
- **User-scoped access** — Admins manage everything; regular users see only their assigned instruments
- **Pluggable transfers** — rclone by default, with a pluggable adapter interface for Globus, rsync, etc.

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

## Project Structure

```
streamweave/
├── docker-compose.yml          # Full stack (Postgres, Redis, Prefect, API, Worker, Frontend)
├── docker-compose.dev.yml      # Dev overrides (hot reload, volume mounts)
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.worker       # Worker image with rclone
│   ├── pyproject.toml
│   └── app/
│       ├── main.py             # FastAPI application
│       ├── config.py           # Pydantic Settings
│       ├── database.py         # Async SQLAlchemy engine
│       ├── models/             # SQLAlchemy models
│       ├── schemas/            # Pydantic request/response models
│       ├── api/                # REST API endpoints
│       ├── services/           # Business logic (credentials, identifiers, Prefect client)
│       ├── flows/              # Prefect flows (harvest orchestration)
│       ├── transfers/          # Transfer adapters (rclone, etc.)
│       ├── hooks/              # Hook system (file filter, metadata enrichment)
│       └── auth/               # fastapi-users configuration
├── frontend/
│   ├── Dockerfile
│   ├── Caddyfile               # Caddy reverse proxy (production)
│   ├── src/
│   │   ├── api/                # Axios client + TypeScript types
│   │   ├── components/         # Shared UI components
│   │   ├── contexts/           # React contexts (auth)
│   │   ├── layouts/            # App shell and layout components
│   │   └── pages/              # Route-level page components
│   └── package.json
├── tests/                      # pytest test suite
├── simlab/                     # Simulated laboratory for integration testing
│   ├── docker-compose.simlab.yml
│   ├── seed.py
│   └── instruments/            # Sample data per instrument
└── scripts/
    ├── build_docs.sh
    └── create-admin.py
```
