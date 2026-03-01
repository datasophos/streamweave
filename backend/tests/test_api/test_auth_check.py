import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_check_admin_returns_200_for_admin(client: AsyncClient, admin_headers: dict):
    response = await client.get("/api/auth/check-admin", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@test.com"


@pytest.mark.asyncio
async def test_check_admin_returns_401_for_unauthenticated(client: AsyncClient):
    response = await client.get("/api/auth/check-admin")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_check_admin_returns_403_for_regular_user(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "regularuser@test.com", "password": "securepassword123"},
    )
    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": "regularuser@test.com", "password": "securepassword123"},
    )
    token = login_resp.json()["access_token"]

    response = await client.get("/api/auth/check-admin", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_check_admin_accepts_cookie(client: AsyncClient, admin_user):
    """Cookie login (used by the browser for Prefect dashboard access) should be accepted."""
    cookie_resp = await client.post(
        "/auth/cookie/login",
        data={"username": "admin@test.com", "password": "testpassword123"},
    )
    assert cookie_resp.status_code == 204  # CookieTransport: token is in Set-Cookie, no body
    assert "streamweave_auth" in cookie_resp.cookies

    # Simulate Caddy forward_auth: browser sends cookie, no Authorization header
    response = await client.get("/api/auth/check-admin", cookies=cookie_resp.cookies)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@test.com"


@pytest.mark.asyncio
async def test_check_admin_rejects_invalid_cookie(client: AsyncClient):
    response = await client.get(
        "/api/auth/check-admin", cookies={"streamweave_auth": "not.a.valid.jwt"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cookie_login_returns_403_for_regular_user(client: AsyncClient):
    password = "securepassword123"
    await client.post(
        "/auth/register",
        json={"email": "regularuser3@test.com", "password": password},
    )
    cookie_resp = await client.post(
        "/auth/cookie/login",
        data={"username": "regularuser3@test.com", "password": password},
    )
    assert cookie_resp.status_code == 204  # CookieTransport: token is in Set-Cookie, no body
    assert "streamweave_auth" in cookie_resp.cookies

    response = await client.get("/api/auth/check-admin", cookies=cookie_resp.cookies)
    assert response.status_code == 403
