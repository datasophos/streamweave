import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.storage import StorageLocation
from app.models.user import User
from app.schemas.storage import StorageLocationCreate, StorageLocationRead, StorageLocationUpdate

router = APIRouter(prefix="/storage-locations", tags=["storage"])


@router.get("", response_model=list[StorageLocationRead])
async def list_storage_locations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(StorageLocation))
    return result.scalars().all()


@router.post("", response_model=StorageLocationRead, status_code=status.HTTP_201_CREATED)
async def create_storage_location(
    data: StorageLocationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    location = StorageLocation(**data.model_dump())
    db.add(location)
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
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    return location


@router.patch("/{location_id}", response_model=StorageLocationRead)
async def update_storage_location(
    location_id: uuid.UUID,
    data: StorageLocationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(location, key, value)
    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    location = await db.get(StorageLocation, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    await db.delete(location)
    await db.commit()
