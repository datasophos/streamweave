import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.auth.setup import current_active_user
from app.models.file import FileRecord
from app.models.transfer import FileTransfer
from app.models.user import User, UserRole
from app.schemas.transfer import FileTransferRead
from app.services.access import accessible_file_ids

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[FileTransferRead])
async def list_transfers(
    file_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    query = select(FileTransfer).options(selectinload(FileTransfer.file))
    if file_id:
        query = query.where(FileTransfer.file_id == file_id)

    if user.role != UserRole.admin:
        from sqlalchemy import or_

        visible_files = select(FileRecord.id).where(
            or_(
                FileRecord.owner_id == user.id,
                FileRecord.id.in_(accessible_file_ids(user)),
            )
        )
        query = query.where(FileTransfer.file_id.in_(visible_files))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{transfer_id}", response_model=FileTransferRead)
async def get_transfer(
    transfer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    result = await db.execute(
        select(FileTransfer)
        .options(selectinload(FileTransfer.file))
        .where(FileTransfer.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if user.role != UserRole.admin:
        from sqlalchemy import exists, or_

        can_access = await db.scalar(
            select(
                exists().where(
                    or_(
                        FileRecord.owner_id == user.id,
                        FileRecord.id.in_(accessible_file_ids(user)),
                    )
                ).where(FileRecord.id == transfer.file_id)
            )
        )
        if not can_access:
            raise HTTPException(status_code=404, detail="Transfer not found")

    return transfer
