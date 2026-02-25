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
async def test_non_admin_instruments_rejected(client: AsyncClient, regular_headers: dict):
    response = await client.get("/api/instruments", headers=regular_headers)
    assert response.status_code == 403
