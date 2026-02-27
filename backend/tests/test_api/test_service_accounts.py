import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_service_account(client: AsyncClient, admin_headers: dict):
    data = {
        "name": "Lab Service Account",
        "domain": "WORKGROUP",
        "username": "labuser",
        "password": "labpass123",
    }
    response = await client.post("/api/service-accounts", json=data, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Lab Service Account"
    assert body["username"] == "labuser"
    # Password should not be in the response
    assert "password" not in body
    assert "password_encrypted" not in body


@pytest.mark.asyncio
async def test_list_service_accounts(client: AsyncClient, admin_headers: dict):
    await client.post(
        "/api/service-accounts",
        json={"name": "SA1", "username": "u1", "password": "p1234567"},
        headers=admin_headers,
    )
    response = await client.get("/api/service-accounts", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_service_account_password(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "SA2", "username": "u2", "password": "oldpass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/service-accounts/{sa_id}",
        json={"password": "newpass123"},
        headers=admin_headers,
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_service_account(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "SA3", "username": "u3", "password": "pass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    response = await client.get(f"/api/service-accounts/{sa_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "SA3"


@pytest.mark.asyncio
async def test_get_nonexistent_service_account(client: AsyncClient, admin_headers: dict):
    response = await client.get(f"/api/service-accounts/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_service_account(client: AsyncClient, admin_headers: dict):
    response = await client.patch(
        f"/api/service-accounts/{uuid.uuid4()}",
        json={"name": "X"},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_service_account_non_password_field(client: AsyncClient, admin_headers: dict):
    """Test updating a field other than password (covers the non-password update path)."""
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "SA4", "username": "u4", "password": "pass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/service-accounts/{sa_id}",
        json={"name": "Renamed SA4"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed SA4"


@pytest.mark.asyncio
async def test_delete_service_account(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "SA5", "username": "u5", "password": "pass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    response = await client.delete(f"/api/service-accounts/{sa_id}", headers=admin_headers)
    assert response.status_code == 204
    # Verify deleted
    response = await client.get(f"/api/service-accounts/{sa_id}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_service_account(client: AsyncClient, admin_headers: dict):
    response = await client.delete(f"/api/service-accounts/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_restore_service_account(client: AsyncClient, admin_headers: dict):
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "RestoreSA", "username": "rsa", "password": "pass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    await client.delete(f"/api/service-accounts/{sa_id}", headers=admin_headers)
    resp = await client.post(f"/api/service-accounts/{sa_id}/restore", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == sa_id


@pytest.mark.asyncio
async def test_restore_non_deleted_service_account_returns_404(
    client: AsyncClient, admin_headers: dict
):
    create_resp = await client.post(
        "/api/service-accounts",
        json={"name": "ActiveSA", "username": "asa", "password": "pass123"},
        headers=admin_headers,
    )
    sa_id = create_resp.json()["id"]
    resp = await client.post(f"/api/service-accounts/{sa_id}/restore", headers=admin_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_non_admin_service_accounts_rejected(client: AsyncClient, regular_headers: dict):
    response = await client.get("/api/service-accounts", headers=regular_headers)
    assert response.status_code == 403
