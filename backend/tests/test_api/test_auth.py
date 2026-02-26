import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # Register
    reg_resp = await client.post(
        "/auth/register",
        json={"email": "newuser@test.com", "password": "securepassword123"},
    )
    assert reg_resp.status_code == 201
    assert reg_resp.json()["email"] == "newuser@test.com"

    # Login
    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": "newuser@test.com", "password": "securepassword123"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user):
    response = await client.post(
        "/auth/jwt/login",
        data={"username": "admin@test.com", "password": "wrongpassword"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_access_protected_route(client: AsyncClient):
    response = await client.get("/api/instruments")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_non_admin_cannot_access_admin_routes(client: AsyncClient):
    # Register a regular user
    await client.post(
        "/auth/register",
        json={"email": "regular@test.com", "password": "securepassword123"},
    )
    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": "regular@test.com", "password": "securepassword123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/instruments",
        json={
            "name": "test",
            "adapter_type": "rclone_smb",
            "host": "h",
            "share": "s",
            "storage_location_id": None,
        },
        headers=headers,
    )
    assert response.status_code == 403
