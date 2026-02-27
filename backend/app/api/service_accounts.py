import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.audit import AuditAction
from app.models.instrument import ServiceAccount
from app.models.user import User
from app.schemas.instrument import ServiceAccountCreate, ServiceAccountRead, ServiceAccountUpdate
from app.services.audit import log_action
from app.services.credentials import encrypt_value

router = APIRouter(prefix="/service-accounts", tags=["service-accounts"])


@router.get("", response_model=list[ServiceAccountRead])
async def list_service_accounts(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(ServiceAccount)
    if not include_deleted:
        stmt = stmt.where(ServiceAccount.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ServiceAccountRead, status_code=status.HTTP_201_CREATED)
async def create_service_account(
    data: ServiceAccountCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    account = ServiceAccount(
        name=data.name,
        domain=data.domain,
        username=data.username,
        password_encrypted=encrypt_value(data.password),
    )
    db.add(account)
    await db.flush()
    await log_action(db, "service_account", account.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=ServiceAccountRead)
async def get_service_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account or account.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Service account not found")
    return account


@router.patch("/{account_id}", response_model=ServiceAccountRead)
async def update_service_account(
    account_id: uuid.UUID,
    data: ServiceAccountUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account or account.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Service account not found")
    update_data = data.model_dump(exclude_unset=True)
    changes: dict = {}
    if "password" in update_data:
        update_data["password_encrypted"] = encrypt_value(update_data.pop("password"))
        changes["password"] = {"before": "***", "after": "***"}
    for key, value in update_data.items():
        before = getattr(account, key)
        setattr(account, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "service_account", account.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account or account.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Service account not found")
    account.deleted_at = datetime.now(UTC)
    await log_action(db, "service_account", account.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{account_id}/restore", response_model=ServiceAccountRead)
async def restore_service_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account or account.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted service account not found")
    account.deleted_at = None
    await log_action(db, "service_account", account.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(account)
    return account
