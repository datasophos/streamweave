"""Tests for the notifications service."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from app.services.notifications import (
    create_notification,
    notify_admins,
    notify_instrument_request_submitted,
)


@pytest.mark.asyncio
async def test_create_notification(db_session: AsyncSession, regular_user: User):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test_type",
        title="Test Title",
        message="Test message",
        link="/some/link",
    )
    await db_session.commit()

    assert notif.id is not None
    assert notif.type == "test_type"
    assert notif.title == "Test Title"
    assert notif.read is False
    assert notif.link == "/some/link"


@pytest.mark.asyncio
async def test_create_notification_no_link(db_session: AsyncSession, regular_user: User):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="No link",
        message="msg",
    )
    await db_session.commit()
    assert notif.link is None


@pytest.mark.asyncio
async def test_notify_admins_creates_notifications(db_session: AsyncSession, admin_user: User):
    with patch("app.services.notifications.send_email", new_callable=AsyncMock):
        await notify_admins(
            db_session,
            type="test",
            title="Admin Alert",
            message="Something happened.",
        )
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.recipient_id == admin_user.id)
    )
    notifications = result.scalars().all()
    assert len(notifications) >= 1
    assert notifications[0].title == "Admin Alert"


@pytest.mark.asyncio
async def test_notify_admins_sends_email_when_provided(db_session: AsyncSession, admin_user: User):
    with patch("app.services.notifications.send_email", new_callable=AsyncMock) as mock_email:
        await notify_admins(
            db_session,
            type="test",
            title="Alert",
            message="msg",
            email_subject="Test Subject",
            email_body="<p>Body</p>",
        )
    mock_email.assert_awaited_once()
    call_args = mock_email.call_args
    # send_email(recipients, subject, body)
    assert call_args[0][1] == "Test Subject"


@pytest.mark.asyncio
async def test_notify_admins_no_email_when_not_provided(db_session: AsyncSession, admin_user: User):
    with patch("app.services.notifications.send_email", new_callable=AsyncMock) as mock_email:
        await notify_admins(
            db_session,
            type="test",
            title="Alert",
            message="msg",
        )
    mock_email.assert_not_awaited()


@pytest.mark.asyncio
async def test_notify_instrument_request_submitted(db_session: AsyncSession, admin_user: User):
    request_id = uuid.uuid4()
    with patch("app.services.notifications.send_email", new_callable=AsyncMock):
        await notify_instrument_request_submitted(
            db_session,
            request_id=request_id,
            requester_email="user@example.com",
            instrument_name="TEM Microscope",
        )
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.recipient_id == admin_user.id)
    )
    notifications = result.scalars().all()
    assert any("TEM Microscope" in n.message for n in notifications)
    assert any(n.type == "instrument_request_submitted" for n in notifications)


@pytest.mark.asyncio
async def test_notify_admins_email_failure_is_logged_not_raised(
    db_session: AsyncSession, admin_user: User
):
    """Email send failure should be caught and logged, not re-raised."""
    with patch(
        "app.services.notifications.send_email",
        new_callable=AsyncMock,
        side_effect=Exception("SMTP error"),
    ):
        # Should not raise
        await notify_admins(
            db_session,
            type="test",
            title="Alert",
            message="msg",
            email_subject="Subject",
            email_body="<p>Body</p>",
        )


@pytest.mark.asyncio
async def test_notify_user_request_reviewed(db_session: AsyncSession, regular_user: User):
    from app.services.notifications import notify_user_request_reviewed

    await notify_user_request_reviewed(
        db_session,
        requester_id=regular_user.id,
        instrument_name="SEM",
        status="approved",
    )
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.recipient_id == regular_user.id)
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1
    assert "approved" in notifications[0].type
    assert "SEM" in notifications[0].message


@pytest.mark.asyncio
async def test_notify_user_request_reviewed_rejected(db_session: AsyncSession, regular_user: User):
    from app.services.notifications import notify_user_request_reviewed

    await notify_user_request_reviewed(
        db_session,
        requester_id=regular_user.id,
        instrument_name="NMR",
        status="rejected",
    )
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.recipient_id == regular_user.id)
    )
    notifications = result.scalars().all()
    assert any("rejected" in n.type for n in notifications)
