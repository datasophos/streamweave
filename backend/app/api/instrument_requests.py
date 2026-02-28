"""Instrument request endpoints — users submit, admins review."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.auth.setup import current_active_user
from app.models.audit import AuditAction
from app.models.instrument_request import InstrumentRequest
from app.models.user import User, UserRole
from app.schemas.instrument_request import (
    InstrumentRequestCreate,
    InstrumentRequestRead,
    InstrumentRequestUpdate,
)
from app.services.audit import log_action
from app.services.notifications import (
    notify_instrument_request_submitted,
    notify_user_request_reviewed,
)

router = APIRouter(prefix="/instrument-requests", tags=["instrument-requests"])


@router.post("", response_model=InstrumentRequestRead, status_code=status.HTTP_201_CREATED)
async def create_instrument_request(
    data: InstrumentRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    req = InstrumentRequest(
        requester_id=user.id,
        requester_email=user.email,
        name=data.name,
        location=data.location,
        harvest_frequency=data.harvest_frequency,
        description=data.description,
        justification=data.justification,
    )
    db.add(req)
    await db.flush()
    await notify_instrument_request_submitted(
        db,
        request_id=req.id,
        requester_email=user.email,
        instrument_name=req.name,
    )
    await log_action(db, "instrument_request", req.id, AuditAction.create, user)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("", response_model=list[InstrumentRequestRead])
async def list_instrument_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    if user.role == UserRole.admin:
        stmt = select(InstrumentRequest).order_by(InstrumentRequest.created_at.desc())
    else:
        stmt = (
            select(InstrumentRequest)
            .where(InstrumentRequest.requester_id == user.id)
            .order_by(InstrumentRequest.created_at.desc())
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{request_id}", response_model=InstrumentRequestRead)
async def get_instrument_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    req = await db.get(InstrumentRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user.role != UserRole.admin and req.requester_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return req


@router.patch("/{request_id}", response_model=InstrumentRequestRead)
async def review_instrument_request(
    request_id: uuid.UUID,
    data: InstrumentRequestUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = await db.get(InstrumentRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    old_status = req.status.value
    req.status = data.status
    req.admin_notes = data.admin_notes
    await notify_user_request_reviewed(
        db,
        requester_id=req.requester_id,
        instrument_name=req.name,
        status=data.status.value,
    )
    await log_action(
        db,
        "instrument_request",
        req.id,
        AuditAction.update,
        admin,
        {"status": {"before": old_status, "after": data.status.value}},
    )
    await db.commit()
    await db.refresh(req)
    return req
