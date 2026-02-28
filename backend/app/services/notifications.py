"""Notification service — creates in-app Notification records and sends emails."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.email import send_email

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    *,
    recipient_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
) -> Notification:
    notif = Notification(
        recipient_id=recipient_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)
    await db.flush()
    return notif


async def notify_admins(
    db: AsyncSession,
    *,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    email_subject: str | None = None,
    email_body: str | None = None,
) -> None:
    """Create in-app notifications for all active admins and optionally send email."""
    result = await db.execute(select(User).where(User.role == UserRole.admin))
    admins = [u for u in result.scalars().all() if u.is_active]

    for admin in admins:
        await create_notification(
            db,
            recipient_id=admin.id,
            type=type,
            title=title,
            message=message,
            link=link,
        )

    if email_subject and email_body and admins:
        admin_emails = [a.email for a in admins]
        try:
            await send_email(admin_emails, email_subject, email_body)
        except Exception:
            logger.exception("Failed to send admin notification email")


async def notify_instrument_request_submitted(
    db: AsyncSession,
    *,
    request_id: uuid.UUID,
    requester_email: str,
    instrument_name: str,
) -> None:
    await notify_admins(
        db,
        type="instrument_request_submitted",
        title="New Instrument Request",
        message=f'{requester_email} requested harvest access for "{instrument_name}".',
        link="/admin/instrument-requests",
        email_subject="[StreamWeave] New Instrument Request",
        email_body=(
            f"<p>A new instrument harvest request has been submitted.</p>"
            f"<ul>"
            f"<li><strong>Instrument:</strong> {instrument_name}</li>"
            f"<li><strong>Requester:</strong> {requester_email}</li>"
            f"<li><strong>Request ID:</strong> {request_id}</li>"
            f"</ul>"
            f'<p><a href="/admin/instrument-requests">Review in StreamWeave</a></p>'
        ),
    )


async def notify_user_request_reviewed(
    db: AsyncSession,
    *,
    requester_id: uuid.UUID,
    instrument_name: str,
    status: str,
) -> None:
    approved = status == "approved"
    await create_notification(
        db,
        recipient_id=requester_id,
        type=f"instrument_request_{status}",
        title=f"Request {'Approved' if approved else 'Rejected'}",
        message=(
            f'Your request for "{instrument_name}" has been {"approved" if approved else "rejected"}.'
        ),
        link="/request",
    )
