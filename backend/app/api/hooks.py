import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.hook import HookConfig
from app.models.user import User
from app.schemas.hook import HookConfigCreate, HookConfigRead, HookConfigUpdate

router = APIRouter(prefix="/hooks", tags=["hooks"])


@router.get("", response_model=list[HookConfigRead])
async def list_hooks(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(HookConfig))
    return result.scalars().all()


@router.post("", response_model=HookConfigRead, status_code=status.HTTP_201_CREATED)
async def create_hook(
    data: HookConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    hook = HookConfig(**data.model_dump())
    db.add(hook)
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
    if not hook:
        raise HTTPException(status_code=404, detail="Hook not found")
    return hook


@router.patch("/{hook_id}", response_model=HookConfigRead)
async def update_hook(
    hook_id: uuid.UUID,
    data: HookConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook:
        raise HTTPException(status_code=404, detail="Hook not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(hook, key, value)
    await db.commit()
    await db.refresh(hook)
    return hook


@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hook(
    hook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    hook = await db.get(HookConfig, hook_id)
    if not hook:
        raise HTTPException(status_code=404, detail="Hook not found")
    await db.delete(hook)
    await db.commit()
