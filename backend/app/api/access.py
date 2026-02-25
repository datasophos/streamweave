import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.access import FileAccessGrant
from app.models.file import FileRecord
from app.models.user import User
from app.schemas.access import FileAccessGrantCreate, FileAccessGrantRead

router = APIRouter(prefix="/files/{file_id}/access", tags=["file-access"])


async def _get_file_or_404(file_id: uuid.UUID, db: AsyncSession) -> FileRecord:
    file_record = await db.get(FileRecord, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    return file_record


@router.get("", response_model=list[FileAccessGrantRead])
async def list_file_access(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await _get_file_or_404(file_id, db)
    result = await db.execute(
        select(FileAccessGrant).where(FileAccessGrant.file_id == file_id)
    )
    return result.scalars().all()


@router.post("", response_model=FileAccessGrantRead, status_code=status.HTTP_201_CREATED)
async def grant_file_access(
    file_id: uuid.UUID,
    data: FileAccessGrantCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await _get_file_or_404(file_id, db)
    grant = FileAccessGrant(
        file_id=file_id,
        grantee_type=data.grantee_type,
        grantee_id=data.grantee_id,
    )
    db.add(grant)
    await db.commit()
    await db.refresh(grant)
    return grant


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_file_access(
    file_id: uuid.UUID,
    grant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await _get_file_or_404(file_id, db)
    grant = await db.get(FileAccessGrant, grant_id)
    if not grant or grant.file_id != file_id:
        raise HTTPException(status_code=404, detail="Grant not found")
    await db.delete(grant)
    await db.commit()
