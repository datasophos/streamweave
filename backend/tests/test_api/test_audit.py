"""Tests for the audit log endpoint and audit trail creation."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_audit_log_requires_admin(client: AsyncClient, regular_headers: dict):
    response = await client.get("/api/admin/audit-logs", headers=regular_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_audit_log_requires_auth(client: AsyncClient):
    response = await client.get("/api/admin/audit-logs")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_instrument_creates_audit_entry(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/instruments",
        json={"name": "AuditInst", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    audit_resp = await client.get(
        "/api/admin/audit-logs?entity_type=instrument&action=create",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    entries = audit_resp.json()
    assert any(e["action"] == "create" and e["entity_type"] == "instrument" for e in entries)


@pytest.mark.asyncio
async def test_update_instrument_creates_audit_entry_with_changes(
    client: AsyncClient, admin_headers: dict
):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "AuditInst2", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.patch(
        f"/api/instruments/{inst_id}",
        json={"name": "AuditInst2Updated"},
        headers=admin_headers,
    )
    audit_resp = await client.get(
        "/api/admin/audit-logs?entity_type=instrument&action=update",
        headers=admin_headers,
    )
    entries = audit_resp.json()
    update_entries = [e for e in entries if e["entity_id"] == inst_id and e["action"] == "update"]
    assert len(update_entries) >= 1
    changes = update_entries[0]["changes"]
    assert "name" in changes
    assert changes["name"]["before"] == "AuditInst2"
    assert changes["name"]["after"] == "AuditInst2Updated"


@pytest.mark.asyncio
async def test_delete_instrument_creates_audit_entry(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "AuditInst3", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)

    audit_resp = await client.get(
        "/api/admin/audit-logs?entity_type=instrument&action=delete",
        headers=admin_headers,
    )
    entries = audit_resp.json()
    assert any(e["entity_id"] == inst_id and e["action"] == "delete" for e in entries)


@pytest.mark.asyncio
async def test_restore_creates_audit_entry(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "AuditInst4", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)
    await client.post(f"/api/instruments/{inst_id}/restore", headers=admin_headers)

    audit_resp = await client.get(
        "/api/admin/audit-logs?entity_type=instrument&action=restore",
        headers=admin_headers,
    )
    entries = audit_resp.json()
    assert any(e["entity_id"] == inst_id and e["action"] == "restore" for e in entries)


@pytest.mark.asyncio
async def test_audit_log_filters_by_entity_type(client: AsyncClient, admin_headers: dict):
    # Create an instrument to ensure there's at least one instrument audit entry
    await client.post(
        "/api/instruments",
        json={"name": "FilterTest", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    audit_resp = await client.get(
        "/api/admin/audit-logs?entity_type=instrument",
        headers=admin_headers,
    )
    entries = audit_resp.json()
    assert all(e["entity_type"] == "instrument" for e in entries)


@pytest.mark.asyncio
async def test_audit_log_filters_by_actor_id(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/instruments",
        json={"name": "ActorFilter", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    users_resp = await client.get("/api/admin/users", headers=admin_headers)
    admin_id = users_resp.json()[0]["id"]

    audit_resp = await client.get(
        f"/api/admin/audit-logs?actor_id={admin_id}",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    entries = audit_resp.json()
    assert len(entries) >= 1
    assert all(e["actor_id"] == admin_id for e in entries)


@pytest.mark.asyncio
async def test_audit_log_filters_by_since_future(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/instruments",
        json={"name": "SinceFilter", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    audit_resp = await client.get(
        "/api/admin/audit-logs?since=2099-01-01T00:00:00",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) == 0


@pytest.mark.asyncio
async def test_audit_log_filters_by_until_past(client: AsyncClient, admin_headers: dict):
    audit_resp = await client.get(
        "/api/admin/audit-logs?until=2000-01-01T00:00:00",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) == 0


@pytest.mark.asyncio
async def test_audit_log_pagination(client: AsyncClient, admin_headers: dict):
    # Create several instruments to populate audit log
    for i in range(3):
        await client.post(
            "/api/instruments",
            json={"name": f"PaginationInst{i}", "cifs_host": "h", "cifs_share": "s"},
            headers=admin_headers,
        )
    # Limit to 1
    audit_resp = await client.get(
        "/api/admin/audit-logs?limit=1",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) == 1
