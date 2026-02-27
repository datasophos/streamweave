import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.auth.setup import current_active_user
from app.models.audit import AuditAction
from app.models.storage import StorageLocation
from app.models.user import User
from app.schemas.storage import StorageLocationCreate, StorageLocationRead, StorageLocationUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/storage-locations", tags=["storage"])


@router.get("", response_model=list[StorageLocationRead])
async def list_storage_locations(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(current_active_user),
):
    stmt = select(StorageLocation)
    if not include_deleted:
        stmt = stmt.where(StorageLocation.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=StorageLocationRead, status_code=status.HTTP_201_CREATED)
async def create_storage_location(
    data: StorageLocationCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    location = StorageLocation(**data.model_dump())
    db.add(location)
    await db.flush()
    await log_action(db, "storage_location", location.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("/{location_id}", response_model=StorageLocationRead)
async def get_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    return location


@router.patch("/{location_id}", response_model=StorageLocationRead)
async def update_storage_location(
    location_id: uuid.UUID,
    data: StorageLocationUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    changes: dict = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(location, key)
        setattr(location, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "storage_location", location.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    location.deleted_at = datetime.now(UTC)
    location.enabled = False
    await log_action(db, "storage_location", location.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{location_id}/restore", response_model=StorageLocationRead)
async def restore_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted storage location not found")
    location.deleted_at = None
    await log_action(db, "storage_location", location.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(location)
    return location
