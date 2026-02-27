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

    @pytest.mark.asyncio
    async def test_delete_user(self, client, admin_headers, admin_user, regular_user):
        resp = await client.delete(f"/api/admin/users/{regular_user.id}", headers=admin_headers)
        assert resp.status_code == 204
        # Deleted user should not appear in default list
        list_resp = await client.get("/api/admin/users", headers=admin_headers)
        emails = [u["email"] for u in list_resp.json()]
        assert "user@test.com" not in emails

    @pytest.mark.asyncio
    async def test_delete_own_account_rejected(self, client, admin_headers, admin_user):
        resp = await client.delete(f"/api/admin/users/{admin_user.id}", headers=admin_headers)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, client, admin_headers):
        import uuid

        resp = await client.delete(f"/api/admin/users/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_restore_user(self, client, admin_headers, admin_user, regular_user):
        await client.delete(f"/api/admin/users/{regular_user.id}", headers=admin_headers)
        resp = await client.post(
            f"/api/admin/users/{regular_user.id}/restore", headers=admin_headers
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == str(regular_user.id)

    @pytest.mark.asyncio
    async def test_restore_non_deleted_user_returns_404(self, client, admin_headers, regular_user):
        # regular_user is active — restore should 404
        resp = await client.post(
            f"/api/admin/users/{regular_user.id}/restore", headers=admin_headers
        )
        assert resp.status_code == 404
