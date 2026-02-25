"""Tests for the admin users list endpoint."""

import pytest


class TestAdminUsersEndpoint:
    @pytest.mark.asyncio
    async def test_list_users_as_admin(self, client, admin_headers, admin_user):
        resp = await client.get("/api/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) >= 1
        emails = [u["email"] for u in users]
        assert "admin@test.com" in emails

    @pytest.mark.asyncio
    async def test_list_users_non_admin_rejected(self, client, regular_headers, regular_user):
        resp = await client.get("/api/admin/users", headers=regular_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_list_users_unauthenticated(self, client):
        resp = await client.get("/api/admin/users")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_list_users_includes_multiple_users(
        self, client, admin_headers, admin_user, regular_user
    ):
        resp = await client.get("/api/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) == 2
        emails = {u["email"] for u in users}
        assert "admin@test.com" in emails
        assert "user@test.com" in emails
