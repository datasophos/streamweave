"""Notification endpoints for in-app bell."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.setup import current_active_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationRead, UnreadCountRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    stmt = (
        select(Notification)
        .where(Notification.recipient_id == user.id)
        .where(Notification.dismissed_at.is_(None))
        .order_by(Notification.read.asc(), Notification.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/unread-count", response_model=UnreadCountRead)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    stmt = select(Notification).where(
        Notification.recipient_id == user.id,
        Notification.read == False,  # noqa: E712
        Notification.dismissed_at.is_(None),
    )
    result = await db.execute(stmt)
    count = len(result.scalars().all())
    return {"count": count}


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    notif = await db.get(Notification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.recipient_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    notif.read = True
    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    stmt = select(Notification).where(
        Notification.recipient_id == user.id,
        Notification.read == False,  # noqa: E712
    )
    result = await db.execute(stmt)
    for notif in result.scalars().all():
        notif.read = True
    await db.commit()
    return {"ok": True}


@router.post("/{notification_id}/dismiss", response_model=NotificationRead)
async def dismiss_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    notif = await db.get(Notification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.recipient_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    notif.dismissed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(notif)
    return notif
