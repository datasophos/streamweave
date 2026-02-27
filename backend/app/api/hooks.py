import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.audit import AuditAction
from app.models.hook import HookConfig
from app.models.user import User
from app.schemas.hook import HookConfigCreate, HookConfigRead, HookConfigUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/hooks", tags=["hooks"])


@router.get("", response_model=list[HookConfigRead])
async def list_hooks(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(HookConfig)
    if not include_deleted:
        stmt = stmt.where(HookConfig.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=HookConfigRead, status_code=status.HTTP_201_CREATED)
async def create_hook(
    data: HookConfigCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    hook = HookConfig(**data.model_dump())
    db.add(hook)
    await db.flush()
    await log_action(db, "hook", hook.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(hook)
    return hook


@router.get("/{hook_id}", response_model=HookConfigRead)
async def get_hook(
    hook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook or hook.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Hook not found")
    return hook


@router.patch("/{hook_id}", response_model=HookConfigRead)
async def update_hook(
    hook_id: uuid.UUID,
    data: HookConfigUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook or hook.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Hook not found")
    changes: dict = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(hook, key)
        setattr(hook, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "hook", hook.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(hook)
    return hook


@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hook(
    hook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook or hook.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Hook not found")
    hook.deleted_at = datetime.now(UTC)
    hook.enabled = False
    await log_action(db, "hook", hook.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{hook_id}/restore", response_model=HookConfigRead)
async def restore_hook(
    hook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook or hook.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted hook not found")
    hook.deleted_at = None
    await log_action(db, "hook", hook.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(hook)
    return hook
