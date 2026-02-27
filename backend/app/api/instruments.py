import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.auth.setup import current_active_user
from app.models.audit import AuditAction
from app.models.instrument import Instrument
from app.models.user import User
from app.schemas.instrument import InstrumentCreate, InstrumentRead, InstrumentUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("", response_model=list[InstrumentRead])
async def list_instruments(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(current_active_user),
):
    stmt = select(Instrument)
    if not include_deleted:
        stmt = stmt.where(Instrument.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=InstrumentRead, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    data: InstrumentCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    instrument = Instrument(**data.model_dump())
    db.add(instrument)
    await db.flush()
    await log_action(db, "instrument", instrument.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(instrument)
    return instrument


@router.get("/{instrument_id}", response_model=InstrumentRead)
async def get_instrument(
    instrument_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument or instrument.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument


@router.patch("/{instrument_id}", response_model=InstrumentRead)
async def update_instrument(
    instrument_id: uuid.UUID,
    data: InstrumentUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument or instrument.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    changes: dict = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(instrument, key)
        setattr(instrument, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "instrument", instrument.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(instrument)
    return instrument


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instrument(
    instrument_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument or instrument.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    instrument.deleted_at = datetime.now(UTC)
    instrument.enabled = False
    await log_action(db, "instrument", instrument.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{instrument_id}/restore", response_model=InstrumentRead)
async def restore_instrument(
    instrument_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument or instrument.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted instrument not found")
    instrument.deleted_at = None
    await log_action(db, "instrument", instrument.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(instrument)
    return instrument
