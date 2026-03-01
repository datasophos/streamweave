# Local Development

The dev stack runs the full StreamWeave service suite in Docker with hot reload, a local HTTPS hostname, pre-seeded test data, and Mailpit for email testing.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- `uv` — Python package manager ([install](https://docs.astral.sh/uv/))

## One-Time Host Setup

### 1. Add the dev hostname to `/etc/hosts`

The dev stack is served at `https://streamweave.local`. Because `.local` mDNS only resolves real LAN devices (not loopback), you need a manual hosts entry:

=== "macOS / Linux"

    ```bash
    echo '127.0.0.1 streamweave.local' | sudo tee -a /etc/hosts
    ```

=== "Windows (run as Administrator)"

    ```powershell
    Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "127.0.0.1 streamweave.local"
    ```

### 2. Trust the Caddy local CA

A dev CA certificate is bundled in the repo at `caddy/certs/ca.crt`. By installing it into your OS trust store, your browser will permanently accept `https://streamweave.local` regardless of how many times you rebuild or recreate containers.

=== "macOS"

    ```bash
    sudo security add-trusted-cert -d -r trustRoot \
      -k /Library/Keychains/System.keychain \
      caddy/certs/ca.crt
    ```

=== "Linux"

    ```bash
    sudo cp caddy/certs/ca.crt \
      /usr/local/share/ca-certificates/streamweave-dev-ca.crt
    sudo update-ca-certificates
    ```

=== "Windows (run as Administrator)"

    ```powershell
    Import-Certificate `
      -FilePath "caddy\certs\ca.crt" `
      -CertStoreLocation Cert:\LocalMachine\Root
    ```

Restart your browser after installing the certificate.

## Starting the Dev Stack

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

On first boot, the `dev-seed` container automatically seeds the database with sample instruments, storage locations, schedules, and hooks. Re-running is safe — existing records are skipped.

## Services

| Service | URL | Description |
|---|---|---|
| **StreamWeave UI** | `https://streamweave.local` | React frontend (Vite hot reload via Caddy) |
| **Prefect UI** | `https://streamweave.local/prefect/` | Orchestration dashboard (admin-only) |
| **Mailpit** | `https://streamweave.local/mail/` | SMTP catch-all — inspect all outgoing emails |
| **S3-dev** | `https://streamweave.local/s3/` | S3-compatible storage (access key: `devkey`, secret: `devsecret`) |
| **API docs** | `https://streamweave.local/docs` | Swagger UI |
| **API ReDoc** | `https://streamweave.local/redoc` | ReDoc API reference |

The CIFS instrument simulators (NMR, HPLC, MS, TEM) are available internally on the Docker network for the worker to harvest from.

## Logging In

### Demo mode shortcuts

The dev stack runs with `VITE_DEMO_MODE=true`, which adds one-click login buttons on the login page for the two seeded accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `adminpassword` |
| Regular user | *(from seed)* | — |

You can override the admin credentials with environment variables before starting:

```bash
export ADMIN_EMAIL=me@example.com
export ADMIN_PASSWORD=mypassword
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Hot Reload

- **Frontend**: Vite serves `frontend/src/` directly; changes reload the browser instantly.
- **Backend**: `uvicorn --reload` watches `backend/app/`; changes restart the API server.

## Running Tests

Backend (from `backend/`):

```bash
uv run pytest tests/ --ignore=tests/test_e2e
```

Frontend (from `frontend/`):

```bash
npm test -- --run
```

Both suites use in-process mocks and do not require the Docker stack to be running.

## Linting

```bash
bash scripts/lint_backend.sh
bash scripts/lint_frontend.sh
```
