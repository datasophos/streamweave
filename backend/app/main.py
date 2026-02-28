from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.access import router as access_router
from app.api.audit import router as audit_router
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
    register_router,
    reset_password_router,
    users_router,
    verify_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Streamweave",
        description="Scientific instrument data harvesting and management system",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Auth routes
    app.include_router(auth_router, prefix="/auth/jwt", tags=["auth"])
    app.include_router(register_router, prefix="/auth", tags=["auth"])
    app.include_router(verify_router, prefix="/auth", tags=["auth"])
    app.include_router(reset_password_router, prefix="/auth", tags=["auth"])
    app.include_router(users_router, prefix="/users", tags=["users"])
    app.include_router(admin_users_router, prefix="/api", tags=["users"])

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

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
