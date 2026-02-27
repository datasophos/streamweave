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
from app.schemas.storage import (
    MASKED,
    SENSITIVE_FIELDS,
    StorageLocationCreate,
    StorageLocationRead,
    StorageLocationUpdate,
    mask_sensitive,
)
from app.services import storage_test as _storage_test
from app.services.audit import log_action
from app.services.credentials import encrypt_value

router = APIRouter(prefix="/storage-locations", tags=["storage"])


def _encrypt_sensitive(storage_type: str, config: dict | None) -> dict | None:
    """Return config with sensitive values encrypted."""
    if config is None:
        return None
    sensitive = SENSITIVE_FIELDS.get(storage_type, [])
    if not sensitive:
        return config
    return {
        k: (encrypt_value(v) if k in sensitive and v != MASKED else v) for k, v in config.items()
    }


def _apply_sensitive_update(
    existing_config: dict | None, update_config: dict | None, storage_type: str
) -> dict | None:
    """Merge update_config into existing_config, preserving encrypted values when update value is MASKED."""
    if update_config is None:
        return existing_config
    sensitive = SENSITIVE_FIELDS.get(storage_type, [])
    merged = dict(existing_config or {})
    for k, v in update_config.items():
        if k in sensitive and v == MASKED:
            pass  # keep existing encrypted value
        elif k in sensitive:
            merged[k] = encrypt_value(v)
        else:
            merged[k] = v
    return merged


def _read_location(location: StorageLocation) -> StorageLocationRead:
    masked = mask_sensitive(location.type, location.connection_config)
    data = StorageLocationRead.model_validate(location)
    data.connection_config = masked
    return data


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
    return [_read_location(loc) for loc in result.scalars().all()]


@router.post("", response_model=StorageLocationRead, status_code=status.HTTP_201_CREATED)
async def create_storage_location(
    data: StorageLocationCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    encrypted_config = _encrypt_sensitive(data.type, data.connection_config)
    location = StorageLocation(
        name=data.name,
        type=data.type,
        base_path=data.base_path,
        enabled=data.enabled,
        connection_config=encrypted_config,
    )
    db.add(location)
    await db.flush()
    await log_action(db, "storage_location", location.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(location)
    return _read_location(location)


@router.get("/{location_id}", response_model=StorageLocationRead)
async def get_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    return _read_location(location)


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
    update_dict = data.model_dump(exclude_unset=True)

    if "connection_config" in update_dict:
        new_type = update_dict.get("type", location.type)
        merged = _apply_sensitive_update(
            location.connection_config, update_dict["connection_config"], new_type
        )
        update_dict["connection_config"] = merged
        changes["connection_config"] = {"before": "***", "after": "***"}

    for key, value in update_dict.items():
        if key == "connection_config":
            location.connection_config = value
        else:
            before = getattr(location, key)
            setattr(location, key, value)
            changes[key] = {"before": before, "after": value}

    await log_action(db, "storage_location", location.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(location)
    return _read_location(location)


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
    return _read_location(location)


@router.get("/{location_id}/test", response_model=dict)
async def test_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Test actual connectivity for a storage location."""
    location = await db.get(StorageLocation, location_id)
    if not location or location.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    if not location.enabled:
        raise HTTPException(status_code=409, detail="Storage location is disabled")

    config = location.connection_config or {}
    storage_type = location.type

    if storage_type == "posix":
        ok, detail = await _storage_test.test_posix(location.base_path)
    elif storage_type == "s3":
        ok, detail = await _storage_test.test_s3(config, location.base_path)
    elif storage_type == "cifs":
        ok, detail = await _storage_test.test_cifs(config)
    elif storage_type == "nfs":
        ok, detail = await _storage_test.test_nfs(config)
    else:
        ok, detail = True, "ok"

    if not ok:
        raise HTTPException(status_code=502, detail=detail)
    return {"status": "ok", "type": storage_type, "name": location.name}
