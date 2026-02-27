import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.audit import AuditAction
from app.models.instrument import Instrument
from app.models.schedule import HarvestSchedule
from app.models.user import User
from app.schemas.schedule import HarvestScheduleCreate, HarvestScheduleRead, HarvestScheduleUpdate
from app.services.audit import log_action
from app.services.prefect_client import PrefectClientService

router = APIRouter(prefix="/schedules", tags=["schedules"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[HarvestScheduleRead])
async def list_schedules(
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(HarvestSchedule)
    if not include_deleted:
        stmt = stmt.where(HarvestSchedule.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=HarvestScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: HarvestScheduleCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    schedule = HarvestSchedule(**data.model_dump())
    db.add(schedule)
    await db.flush()
    await log_action(db, "schedule", schedule.id, AuditAction.create, actor)
    await db.commit()
    await db.refresh(schedule)

    # Best-effort Prefect deployment creation
    try:
        instrument = await db.get(Instrument, data.instrument_id)
        instrument_name = instrument.name if instrument else str(data.instrument_id)
        prefect_svc = PrefectClientService()
        deployment_id = await prefect_svc.create_deployment(
            instrument_id=str(data.instrument_id),
            instrument_name=instrument_name,
            schedule_id=str(schedule.id),
            cron_expression=data.cron_expression,
            enabled=data.enabled,
        )
        if deployment_id:
            schedule.prefect_deployment_id = deployment_id
            await db.commit()
            await db.refresh(schedule)
    except Exception:
        logger.warning("Prefect deployment creation failed — schedule saved without it")

    return schedule


@router.get("/{schedule_id}", response_model=HarvestScheduleRead)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule or schedule.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.patch("/{schedule_id}", response_model=HarvestScheduleRead)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: HarvestScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule or schedule.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    updates = data.model_dump(exclude_unset=True)
    changes: dict = {}
    for key, value in updates.items():
        before = getattr(schedule, key)
        setattr(schedule, key, value)
        changes[key] = {"before": before, "after": value}
    await log_action(db, "schedule", schedule.id, AuditAction.update, actor, changes)
    await db.commit()
    await db.refresh(schedule)

    # Best-effort Prefect deployment update
    if schedule.prefect_deployment_id and ("cron_expression" in updates or "enabled" in updates):
        try:
            prefect_svc = PrefectClientService()
            await prefect_svc.update_deployment(
                schedule.prefect_deployment_id,
                cron_expression=updates.get("cron_expression"),
                enabled=updates.get("enabled"),
            )
        except Exception:
            logger.warning("Prefect deployment update failed")

    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule or schedule.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Best-effort Prefect deployment deletion
    if schedule.prefect_deployment_id:
        try:
            prefect_svc = PrefectClientService()
            await prefect_svc.delete_deployment(schedule.prefect_deployment_id)
        except Exception:
            logger.warning("Prefect deployment deletion failed")

    schedule.deleted_at = datetime.now(UTC)
    schedule.enabled = False
    await log_action(db, "schedule", schedule.id, AuditAction.delete, actor)
    await db.commit()


@router.post("/{schedule_id}/restore", response_model=HarvestScheduleRead)
async def restore_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule or schedule.deleted_at is None:
        raise HTTPException(status_code=404, detail="Deleted schedule not found")
    schedule.deleted_at = None
    await log_action(db, "schedule", schedule.id, AuditAction.restore, actor)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.post("/{schedule_id}/trigger")
async def trigger_harvest(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Trigger a manual harvest for this schedule."""
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule or schedule.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if not schedule.prefect_deployment_id:
        raise HTTPException(
            status_code=400,
            detail="Schedule has no Prefect deployment — cannot trigger harvest",
        )

    prefect_svc = PrefectClientService()
    flow_run_id = await prefect_svc.trigger_harvest(
        schedule.prefect_deployment_id,
        parameters={
            "instrument_id": str(schedule.instrument_id),
            "schedule_id": str(schedule.id),
        },
    )

    if not flow_run_id:
        raise HTTPException(
            status_code=502,
            detail="Failed to trigger harvest — Prefect server may be unavailable",
        )

    return {"flow_run_id": flow_run_id, "schedule_id": str(schedule_id)}
