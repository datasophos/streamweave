import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.instrument import Instrument
from app.models.user import User
from app.schemas.instrument import InstrumentCreate, InstrumentRead, InstrumentUpdate

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("", response_model=list[InstrumentRead])
async def list_instruments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Instrument))
    return result.scalars().all()


@router.post("", response_model=InstrumentRead, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    data: InstrumentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    instrument = Instrument(**data.model_dump())
    db.add(instrument)
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
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument


@router.patch("/{instrument_id}", response_model=InstrumentRead)
async def update_instrument(
    instrument_id: uuid.UUID,
    data: InstrumentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(instrument, key, value)
    await db.commit()
    await db.refresh(instrument)
    return instrument


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instrument(
    instrument_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    instrument = await db.get(Instrument, instrument_id)
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    await db.delete(instrument)
    await db.commit()
