"""Tests for instrument request endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, AuditLog

VALID_PAYLOAD = {
    "name": "Bruker NMR",
    "location": "Lab 3B",
    "harvest_frequency": "daily",
    "justification": "Research requires daily harvest.",
}


@pytest.mark.asyncio
async def test_create_request_requires_auth(client: AsyncClient):
    response = await client.post("/api/instrument-requests", json=VALID_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_request_as_regular_user(client: AsyncClient, regular_headers: dict):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Bruker NMR"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_requester_email_in_response(client: AsyncClient, regular_headers: dict):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    assert response.status_code == 201
    assert response.json()["requester_email"] == "user@test.com"


@pytest.mark.asyncio
async def test_create_request_notifies_admins(client: AsyncClient, regular_headers: dict):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ) as mock_notify:
        await client.post("/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers)
    mock_notify.assert_awaited_once()
    _, kwargs = mock_notify.call_args
    assert kwargs["instrument_name"] == "Bruker NMR"


@pytest.mark.asyncio
async def test_create_request_with_optional_description(client: AsyncClient, regular_headers: dict):
    payload = {**VALID_PAYLOAD, "description": "A nuclear magnetic resonance spectrometer."}
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            "/api/instrument-requests", json=payload, headers=regular_headers
        )
    assert response.status_code == 201
    assert response.json()["description"] == "A nuclear magnetic resonance spectrometer."


@pytest.mark.asyncio
async def test_audit_log_created_on_create(
    client: AsyncClient,
    regular_headers: dict,
    db_session: AsyncSession,
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    assert response.status_code == 201

    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "instrument_request",
            AuditLog.action == AuditAction.create,
        )
    )
    entries = result.scalars().all()
    assert len(entries) == 1
    assert entries[0].actor_email == "user@test.com"


@pytest.mark.asyncio
async def test_list_requests_as_admin_sees_all(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        await client.post("/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers)
    response = await client.get("/api/instrument-requests", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_list_requests_as_user_sees_own(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        await client.post("/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers)
    # Admin creating a request
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        await client.post(
            "/api/instrument-requests",
            json={**VALID_PAYLOAD, "name": "Admin's Request"},
            headers=admin_headers,
        )
    # Regular user should only see their own
    response = await client.get("/api/instrument-requests", headers=regular_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(r["name"] != "Admin's Request" for r in data)


@pytest.mark.asyncio
async def test_get_request_by_owner(client: AsyncClient, regular_headers: dict):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    response = await client.get(f"/api/instrument-requests/{req_id}", headers=regular_headers)
    assert response.status_code == 200
    assert response.json()["id"] == req_id


@pytest.mark.asyncio
async def test_get_request_forbidden_for_other_user(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests",
            json={**VALID_PAYLOAD, "name": "Admin's Thing"},
            headers=admin_headers,
        )
    req_id = create_resp.json()["id"]
    response = await client.get(f"/api/instrument-requests/{req_id}", headers=regular_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_approve_request(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    with patch(
        "app.api.instrument_requests.notify_user_request_reviewed",
        new_callable=AsyncMock,
    ):
        response = await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "approved", "admin_notes": "Looks good!"},
            headers=admin_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"
    assert data["admin_notes"] == "Looks good!"


@pytest.mark.asyncio
async def test_admin_can_reject_request(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    with patch(
        "app.api.instrument_requests.notify_user_request_reviewed",
        new_callable=AsyncMock,
    ):
        response = await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "rejected", "admin_notes": "Not enough budget."},
            headers=admin_headers,
        )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_re_review_already_reviewed_request_succeeds(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    with patch(
        "app.api.instrument_requests.notify_user_request_reviewed",
        new_callable=AsyncMock,
    ):
        await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "approved"},
            headers=admin_headers,
        )
        # Re-review should now succeed (no longer blocked)
        response = await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "rejected"},
            headers=admin_headers,
        )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_audit_log_created_on_review(
    client: AsyncClient,
    regular_headers: dict,
    admin_headers: dict,
    db_session: AsyncSession,
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]

    with patch(
        "app.api.instrument_requests.notify_user_request_reviewed",
        new_callable=AsyncMock,
    ):
        await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "approved"},
            headers=admin_headers,
        )

    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "instrument_request",
            AuditLog.action == AuditAction.update,
        )
    )
    entries = result.scalars().all()
    assert len(entries) == 1
    assert entries[0].actor_email == "admin@test.com"
    assert entries[0].changes == {"status": {"before": "pending", "after": "approved"}}


@pytest.mark.asyncio
async def test_regular_user_cannot_review_request(client: AsyncClient, regular_headers: dict):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/instrument-requests/{req_id}",
        json={"status": "approved"},
        headers=regular_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_nonexistent_request_returns_404(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.get(f"/api/instrument-requests/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_review_nonexistent_request_returns_404(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.patch(
        f"/api/instrument-requests/{uuid.uuid4()}",
        json={"status": "approved"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_review_notifies_requester(
    client: AsyncClient, regular_headers: dict, admin_headers: dict
):
    with patch(
        "app.api.instrument_requests.notify_instrument_request_submitted",
        new_callable=AsyncMock,
    ):
        create_resp = await client.post(
            "/api/instrument-requests", json=VALID_PAYLOAD, headers=regular_headers
        )
    req_id = create_resp.json()["id"]
    with patch(
        "app.api.instrument_requests.notify_user_request_reviewed",
        new_callable=AsyncMock,
    ) as mock_notify:
        await client.patch(
            f"/api/instrument-requests/{req_id}",
            json={"status": "approved"},
            headers=admin_headers,
        )
    mock_notify.assert_awaited_once()
    _, kwargs = mock_notify.call_args
    assert kwargs["status"] == "approved"
