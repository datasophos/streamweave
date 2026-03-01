import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.auth.setup import (  # noqa: F401 (re-exported)
    auth_backend,
    cookie_auth_backend,
    fastapi_users,
)
from app.models.audit import AuditAction
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.audit import log_action

auth_router = fastapi_users.get_auth_router(auth_backend)
cookie_auth_router = fastapi_users.get_auth_router(cookie_auth_backend)
register_router = fastapi_users.get_register_router(UserRead, UserCreate)
users_router = fastapi_users.get_users_router(UserRead, UserUpdate)
verify_router = fastapi_users.get_verify_router(UserRead)
reset_password_router = fastapi_users.get_reset_password_router()

# Admin-only endpoint: list all users (fastapi-users doesn't include this)
admin_users_router = APIRouter(prefix="/admin/users", tags=["users"])


@admin_users_router.get("", response_model=list[UserRead])
async def list_users(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(User)
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@admin_users_router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user.deleted_at = datetime.now(UTC)
    await log_action(db, "user", user.id, AuditAction.delete, actor)
    await db.commit()


@admin_users_router.post("/{user_id}/restore", response_model=UserRead)
async def restore_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user or user.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted user not found")
    user.deleted_at = None
    await log_action(db, "user", user.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(user)
    return user
