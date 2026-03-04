import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.api.pagination import PaginatedResponse, PaginationParams, paginate
from app.auth.setup import current_active_user
from app.models.audit import AuditAction
from app.models.instrument import Instrument
from app.models.schedule import HarvestSchedule
from app.models.user import User
from app.schemas.instrument import InstrumentCreate, InstrumentRead, InstrumentUpdate
from app.services.audit import log_action
from app.services.prefect_client import PrefectClientService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("", response_model=PaginatedResponse[InstrumentRead])
async def list_instruments(
    include_deleted: bool = Query(False),
    pagination: PaginationParams = Depends(PaginationParams),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(current_active_user),
):
    stmt = select(Instrument)
    if not include_deleted:
        stmt = stmt.where(Instrument.deleted_at.is_(None))
    return await paginate(db, stmt, pagination)


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


@router.post("/{instrument_id}/harvest")
async def trigger_instrument_harvest(
    instrument_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Trigger a manual harvest for all active schedules on this instrument."""
    instrument = await db.get(Instrument, instrument_id)
    if not instrument or instrument.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Instrument not found")

    stmt = select(HarvestSchedule).where(
        HarvestSchedule.instrument_id == instrument_id,
        HarvestSchedule.deleted_at.is_(None),
        HarvestSchedule.enabled == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    schedules = result.scalars().all()

    if not schedules:
        raise HTTPException(
            status_code=400,
            detail="No active schedules configured for this instrument",
        )

    prefect_svc = PrefectClientService()
    triggered = []
    errors = []

    for schedule in schedules:
        if not schedule.prefect_deployment_id:
            errors.append(
                {"schedule_id": str(schedule.id), "error": "No Prefect deployment configured"}
            )
            continue
        flow_run_id = await prefect_svc.trigger_harvest(
            schedule.prefect_deployment_id,
            parameters={
                "instrument_id": str(instrument_id),
                "schedule_id": str(schedule.id),
            },
        )
        if flow_run_id:
            triggered.append({"flow_run_id": flow_run_id, "schedule_id": str(schedule.id)})
        else:
            errors.append({"schedule_id": str(schedule.id), "error": "Prefect server unavailable"})

    if not triggered and errors:
        raise HTTPException(status_code=502, detail=errors[0]["error"])

    return {"triggered": triggered, "errors": errors}


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
