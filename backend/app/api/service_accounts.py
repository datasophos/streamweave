import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.instrument import ServiceAccount
from app.models.user import User
from app.schemas.instrument import ServiceAccountCreate, ServiceAccountRead, ServiceAccountUpdate
from app.services.credentials import encrypt_value

router = APIRouter(prefix="/service-accounts", tags=["service-accounts"])


@router.get("", response_model=list[ServiceAccountRead])
async def list_service_accounts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ServiceAccount))
    return result.scalars().all()


@router.post("", response_model=ServiceAccountRead, status_code=status.HTTP_201_CREATED)
async def create_service_account(
    data: ServiceAccountCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    account = ServiceAccount(
        name=data.name,
        domain=data.domain,
        username=data.username,
        password_encrypted=encrypt_value(data.password),
    )
    db.add(account)
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
    if not account:
        raise HTTPException(status_code=404, detail="Service account not found")
    return account


@router.patch("/{account_id}", response_model=ServiceAccountRead)
async def update_service_account(
    account_id: uuid.UUID,
    data: ServiceAccountUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Service account not found")
    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_encrypted"] = encrypt_value(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(account, key, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    account = await db.get(ServiceAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Service account not found")
    await db.delete(account)
    await db.commit()
