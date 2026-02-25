import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.setup import current_active_user
from app.models.file import FileRecord
from app.models.user import User, UserRole
from app.schemas.file import FileRecordRead
from app.services.access import accessible_file_ids, apply_file_access_filter

router = APIRouter(prefix="/files", tags=["files"])


@router.get("", response_model=list[FileRecordRead])
async def list_files(
    instrument_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    query = select(FileRecord)
    if instrument_id:
        query = query.where(FileRecord.instrument_id == instrument_id)

    query = apply_file_access_filter(query, user)

    result = await db.execute(query.order_by(FileRecord.first_discovered_at.desc()))
    return result.scalars().all()


@router.get("/{file_id}", response_model=FileRecordRead)
async def get_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    file_record = await db.get(FileRecord, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if user.role != UserRole.admin:
        # Check if user can access this specific file
        from sqlalchemy import exists, or_

        can_access = await db.scalar(
            select(
                exists().where(
                    or_(
                        FileRecord.owner_id == user.id,
                        FileRecord.id.in_(accessible_file_ids(user)),
                    )
                ).where(FileRecord.id == file_id)
            )
        )
        if not can_access:
            raise HTTPException(status_code=404, detail="File not found")

    return file_record
