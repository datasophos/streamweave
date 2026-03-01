from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import HTMLResponse
from fastapi.routing import APIRoute

from app.api.access import router as access_router
from app.api.audit import router as audit_router
from app.api.auth_check import router as auth_check_router
from app.api.files import router as files_router
from app.api.groups import router as groups_router
from app.api.hooks import router as hooks_router
from app.api.instrument_requests import router as instrument_requests_router
from app.api.instruments import router as instruments_router
from app.api.notifications import router as notifications_router
from app.api.projects import router as projects_router
from app.api.schedules import router as schedules_router
from app.api.service_accounts import router as service_accounts_router
from app.api.storage import router as storage_router
from app.api.transfers import router as transfers_router
from app.api.users import (
    admin_users_router,
    auth_router,
    cookie_auth_router,
    me_router,
    register_router,
    reset_password_router,
    users_router,
    verify_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


_DESCRIPTION = """
Scientific instrument data harvesting and management system.

## Authentication

StreamWeave supports two authentication transports backed by the same JWT strategy.
Choose whichever fits your client:

### Bearer token (recommended for API clients)

1. **Log in** — `POST /auth/jwt/login` (form-encoded `username` / `password`).
   Returns `{"access_token": "...", "token_type": "bearer"}`.
2. **Authenticate requests** — include the token in the `Authorization` header:
   ```
   Authorization: Bearer <access_token>
   ```
3. **Log out** — `POST /auth/jwt/logout` (invalidates the token server-side).

**Example using httpx:**

```python
import httpx

BASE_URL = "https://streamweave.example.com"

with httpx.Client(base_url=BASE_URL) as client:
    # 1. Log in
    resp = client.post(
        "/auth/jwt/login",
        data={"username": "user@example.com", "password": "secret"},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]

    # 2. Authenticated request
    client.headers["Authorization"] = f"Bearer {token}"
    instruments = client.get("/api/instruments").raise_for_status().json()

    # 3. Log out
    client.post("/auth/jwt/logout").raise_for_status()
```

### Cookie (recommended for browser clients)

Use `POST /auth/cookie/login` and `POST /auth/cookie/logout` instead.
The server sets/clears an `HttpOnly` cookie (`streamweave_auth`) automatically;
no manual header management is required.

### Password reset

1. `POST /auth/forgot-password` — send `{"email": "..."}`.
   A reset link is emailed to the address if it matches an account.
2. `POST /auth/reset-password` — send `{"token": "...", "password": "..."}`.

### Token lifetime

Tokens expire after the period configured in `JWT_LIFETIME_SECONDS`
(default: 3 600 s / 1 hour). Re-authenticate with `/login` to obtain a fresh token.
"""


_REDOC_FAVICON = (
    "data:image/svg+xml,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300' fill='none'%3E"
    "%3Cpath d='M245.054 94.8809C245.054 138.62 209.581 174.078 165.823 174.078H36.3477"
    "V166.351C75.8367 166.351 107.849 134.353 107.849 94.8809C107.849 55.4088 75.8367"
    " 23.4104 36.3477 23.4104V15.6838H165.823C209.581 15.6838 245.054 51.1416 245.054"
    " 94.8809Z' fill='%232467F2'/%3E"
    "%3Cpath d='M245.054 282.249C245.054 238.51 209.581 203.052 165.823 203.052H36.3477"
    "V210.779C75.8367 210.779 107.849 242.777 107.849 282.249H245.054Z' fill='%232467F2'/%3E"
    "%3C/svg%3E"
)

_SWAGGER_FAVICON = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/favicon-32x32.png"


def create_app() -> FastAPI:
    app = FastAPI(
        title="StreamWeave",
        description=_DESCRIPTION,
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
    )

    # Auth routes
    app.include_router(auth_router, prefix="/auth/jwt", tags=["auth"])
    app.include_router(cookie_auth_router, prefix="/auth/cookie", tags=["auth"])
    app.include_router(register_router, prefix="/auth", tags=["auth"])
    app.include_router(verify_router, prefix="/auth", tags=["auth"])
    app.include_router(reset_password_router, prefix="/auth", tags=["auth"])
    app.include_router(users_router, prefix="/users", tags=["users"])
    # Hide GET /users/me from docs — /api/me is the canonical endpoint
    for r in app.routes:
        if getattr(r, "path", "") == "/users/me" and "GET" in getattr(r, "methods", set()):
            cast(APIRoute, r).include_in_schema = False
    app.include_router(admin_users_router, prefix="/api")
    app.include_router(me_router, prefix="/api")

    # Resource routes
    app.include_router(instruments_router, prefix="/api")
    app.include_router(storage_router, prefix="/api")
    app.include_router(service_accounts_router, prefix="/api")
    app.include_router(schedules_router, prefix="/api")
    app.include_router(hooks_router, prefix="/api")
    app.include_router(groups_router, prefix="/api")
    app.include_router(projects_router, prefix="/api")
    app.include_router(files_router, prefix="/api")
    app.include_router(access_router, prefix="/api")
    app.include_router(transfers_router, prefix="/api")
    app.include_router(audit_router, prefix="/api")
    app.include_router(instrument_requests_router, prefix="/api")
    app.include_router(notifications_router, prefix="/api")
    app.include_router(auth_check_router)

    @app.get("/swagger", include_in_schema=False)
    async def swagger_ui() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url="/openapi.json",
            title="StreamWeave – Swagger UI",
            swagger_favicon_url=_SWAGGER_FAVICON,
        )

    @app.get("/redoc", include_in_schema=False)
    async def redoc() -> HTMLResponse:
        return get_redoc_html(
            openapi_url="/openapi.json",
            title="StreamWeave – ReDoc",
            redoc_favicon_url=_REDOC_FAVICON,
        )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
