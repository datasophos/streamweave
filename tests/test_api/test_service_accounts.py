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
