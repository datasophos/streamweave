"""Tests for notification endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.notifications import create_notification


@pytest.mark.asyncio
async def test_list_notifications_requires_auth(client: AsyncClient):
    response = await client.get("/api/notifications")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unread_count_requires_auth(client: AsyncClient):
    response = await client.get("/api/notifications/unread-count")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_notifications_empty(client: AsyncClient, regular_headers: dict):
    response = await client.get("/api/notifications", headers=regular_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_unread_count_zero_initially(client: AsyncClient, regular_headers: dict):
    response = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.asyncio
async def test_list_notifications_shows_own(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Hello",
        message="Test message",
    )
    await db_session.commit()

    response = await client.get("/api/notifications", headers=regular_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Hello"
    assert data[0]["read"] is False


@pytest.mark.asyncio
async def test_unread_count_increments(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    for i in range(2):
        await create_notification(
            db_session,
            recipient_id=regular_user.id,
            type="test",
            title=f"Notif {i}",
            message="msg",
        )
    await db_session.commit()

    response = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert response.json()["count"] == 2


@pytest.mark.asyncio
async def test_mark_notification_read(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Mark me",
        message="msg",
    )
    await db_session.commit()

    response = await client.post(f"/api/notifications/{notif.id}/read", headers=regular_headers)
    assert response.status_code == 200
    assert response.json()["read"] is True

    count_resp = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert count_resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_mark_read_forbidden_for_other_user(
    client: AsyncClient,
    admin_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Private",
        message="msg",
    )
    await db_session.commit()

    # Admin tries to mark regular user's notification as read
    response = await client.post(f"/api/notifications/{notif.id}/read", headers=admin_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_mark_read_not_found(client: AsyncClient, regular_headers: dict):
    fake_id = uuid.uuid4()
    response = await client.post(f"/api/notifications/{fake_id}/read", headers=regular_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mark_all_read(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    for i in range(3):
        await create_notification(
            db_session,
            recipient_id=regular_user.id,
            type="test",
            title=f"Notif {i}",
            message="msg",
        )
    await db_session.commit()

    response = await client.post("/api/notifications/read-all", headers=regular_headers)
    assert response.status_code == 200

    count_resp = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert count_resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_notifications_not_shared_between_users(
    client: AsyncClient,
    regular_headers: dict,
    admin_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="User Only",
        message="msg",
    )
    await db_session.commit()

    admin_resp = await client.get("/api/notifications", headers=admin_headers)
    assert all(n["title"] != "User Only" for n in admin_resp.json())


@pytest.mark.asyncio
async def test_dismiss_notification_success(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Dismiss Me",
        message="msg",
    )
    await db_session.commit()

    response = await client.post(f"/api/notifications/{notif.id}/dismiss", headers=regular_headers)
    assert response.status_code == 200
    assert response.json()["dismissed_at"] is not None


@pytest.mark.asyncio
async def test_dismiss_notification_not_found(client: AsyncClient, regular_headers: dict):
    fake_id = uuid.uuid4()
    response = await client.post(f"/api/notifications/{fake_id}/dismiss", headers=regular_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dismiss_notification_forbidden_for_other_user(
    client: AsyncClient,
    admin_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Private",
        message="msg",
    )
    await db_session.commit()

    response = await client.post(f"/api/notifications/{notif.id}/dismiss", headers=admin_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_dismissed_notification_not_in_list(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Dismiss Me",
        message="msg",
    )
    await db_session.commit()

    await client.post(f"/api/notifications/{notif.id}/dismiss", headers=regular_headers)

    response = await client.get("/api/notifications", headers=regular_headers)
    assert response.status_code == 200
    assert all(n["id"] != str(notif.id) for n in response.json())


@pytest.mark.asyncio
async def test_dismissed_notification_not_in_unread_count(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
    regular_user: User,
):
    notif = await create_notification(
        db_session,
        recipient_id=regular_user.id,
        type="test",
        title="Test",
        message="msg",
    )
    await db_session.commit()

    # Before dismiss, count is 1
    resp = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert resp.json()["count"] == 1

    await client.post(f"/api/notifications/{notif.id}/dismiss", headers=regular_headers)

    # After dismiss, count is 0
    resp = await client.get("/api/notifications/unread-count", headers=regular_headers)
    assert resp.json()["count"] == 0
