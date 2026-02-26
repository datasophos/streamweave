import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_storage_location(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Test Archive",
        "type": "posix",
        "base_path": "/mnt/archive",
    }
    response = await client.post("/api/storage-locations", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Archive"
    assert body["type"] == "posix"


@pytest.mark.asyncio
async def test_list_storage_locations(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/storage-locations",
        json={"name": "S1", "type": "s3", "base_path": "s3://bucket"},
        headers=admin_headers,
    )
    response = await client.get("/api/storage-locations", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S2", "type": "posix", "base_path": "/mnt/s2"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/storage-locations/{loc_id}",
        json={"name": "Updated S2"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated S2"


@pytest.mark.asyncio
async def test_delete_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S3", "type": "nfs", "base_path": "/mnt/nfs"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.delete(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_storage_location(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "S4", "type": "posix", "base_path": "/mnt/s4"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.get(f"/api/storage-locations/{loc_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "S4"


@pytest.mark.asyncio
async def test_get_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.get(f"/api/storage-locations/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.patch(
        f"/api/storage-locations/{uuid.uuid4()}",
        json={"name": "X"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_storage_location(client: AsyncClient, admin_headers: dict):
    response = await client.delete(f"/api/storage-locations/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_can_list_storage_locations(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    await client.post(
        "/api/storage-locations",
        json={"name": "Readable", "type": "posix", "base_path": "/mnt/read"},
        headers=admin_headers,
    )
    response = await client.get("/api/storage-locations", headers=regular_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_regular_user_cannot_create_storage_location(
    client: AsyncClient, regular_headers: dict
):
    response = await client.post(
        "/api/storage-locations",
        json={"name": "X", "type": "posix", "base_path": "/x"},
        headers=regular_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_regular_user_cannot_delete_storage_location(
    client: AsyncClient, admin_headers: dict, regular_headers: dict
):
    create_resp = await client.post(
        "/api/storage-locations",
        json={"name": "Y", "type": "posix", "base_path": "/y"},
        headers=admin_headers,
    )
    loc_id = create_resp.json()["id"]
    response = await client.delete(f"/api/storage-locations/{loc_id}", headers=regular_headers)
    assert response.status_code == 403
