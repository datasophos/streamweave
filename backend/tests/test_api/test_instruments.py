import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_instruments_unauthenticated(client: AsyncClient):
    response = await client.get("/api/instruments")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_instrument(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Test Microscope",
        "description": "A test instrument",
        "cifs_host": "192.168.1.100",
        "cifs_share": "microscope",
    }
    response = await client.post("/api/instruments", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Microscope"
    assert body["cifs_host"] == "192.168.1.100"
    assert body["enabled"] is True
    assert "id" in body


@pytest.mark.asyncio
async def test_list_instruments(client: AsyncClient, admin_headers: dict):
    # Create one first
    await client.post(
        "/api/instruments",
        json={"name": "Inst1", "cifs_host": "h1", "cifs_share": "s1"},
        headers=admin_headers,
    )
    response = await client.get("/api/instruments", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_get_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst2", "cifs_host": "h2", "cifs_share": "s2"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.get(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Inst2"


@pytest.mark.asyncio
async def test_update_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst3", "cifs_host": "h3", "cifs_share": "s3"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/instruments/{inst_id}",
        json={"name": "Updated Inst3"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Inst3"


@pytest.mark.asyncio
async def test_delete_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Inst4", "cifs_host": "h4", "cifs_share": "s4"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 204

    # Verify deleted
    response = await client.get(f"/api/instruments/{inst_id}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.get(f"/api/instruments/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.patch(
        f"/api/instruments/{uuid.uuid4()}",
        json={"name": "X"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_instrument(client: AsyncClient, admin_headers: dict):
    import uuid

    response = await client.delete(
        f"/api/instruments/{uuid.uuid4()}",
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_can_list_instruments(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    await client.post(
        "/api/instruments",
        json={"name": "Readable Instrument", "cifs_host": "192.168.1.1", "cifs_share": "data"},
        headers=admin_headers,
    )
    response = await client.get("/api/instruments", headers=regular_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_regular_user_cannot_create_instrument(client: AsyncClient, regular_headers: dict):
    response = await client.post(
        "/api/instruments",
        json={"name": "X", "cifs_host": "192.168.1.1", "cifs_share": "data"},
        headers=regular_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_soft_delete_excluded_from_list(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "ToDelete", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)

    # Default list excludes deleted
    list_resp = await client.get("/api/instruments", headers=admin_headers)
    ids = [i["id"] for i in list_resp.json()]
    assert inst_id not in ids

    # include_deleted=true shows it
    list_resp2 = await client.get("/api/instruments?include_deleted=true", headers=admin_headers)
    ids2 = [i["id"] for i in list_resp2.json()]
    assert inst_id in ids2


@pytest.mark.asyncio
async def test_restore_instrument(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "RestoreMe", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    await client.delete(f"/api/instruments/{inst_id}", headers=admin_headers)

    # Restore
    restore_resp = await client.post(f"/api/instruments/{inst_id}/restore", headers=admin_headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["id"] == inst_id

    # Now appears in regular list
    list_resp = await client.get("/api/instruments", headers=admin_headers)
    ids = [i["id"] for i in list_resp.json()]
    assert inst_id in ids


@pytest.mark.asyncio
async def test_restore_non_deleted_instrument_returns_404(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "NotDeleted", "cifs_host": "h", "cifs_share": "s"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    # Instrument is active (not deleted) — restore should 404
    restore_resp = await client.post(f"/api/instruments/{inst_id}/restore", headers=admin_headers)
    assert restore_resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_delete_instrument(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    create_resp = await client.post(
        "/api/instruments",
        json={"name": "Y", "cifs_host": "192.168.1.2", "cifs_share": "data"},
        headers=admin_headers,
    )
    inst_id = create_resp.json()["id"]
    response = await client.delete(f"/api/instruments/{inst_id}", headers=regular_headers)
    assert response.status_code == 403
