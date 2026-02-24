import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.schedule import HarvestSchedule
from app.models.user import User
from app.schemas.schedule import HarvestScheduleCreate, HarvestScheduleRead, HarvestScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=list[HarvestScheduleRead])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(HarvestSchedule))
    return result.scalars().all()


@router.post("", response_model=HarvestScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: HarvestScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    schedule = HarvestSchedule(**data.model_dump())
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get("/{schedule_id}", response_model=HarvestScheduleRead)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.patch("/{schedule_id}", response_model=HarvestScheduleRead)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: HarvestScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    schedule = await db.get(HarvestSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.delete(schedule)
    await db.commit()
