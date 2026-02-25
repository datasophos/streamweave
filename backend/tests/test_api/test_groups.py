"""Tests for the groups CRUD API."""

import uuid

import pytest
import pytest_asyncio

from app.models.group import Group


@pytest_asyncio.fixture
async def group(db_session):
    g = Group(name="Lab A Team", description="Research group A")
    db_session.add(g)
    await db_session.flush()
    return g


class TestGroupsCRUD:
    @pytest.mark.asyncio
    async def test_create_group(self, client, admin_headers):
        resp = await client.post(
            "/api/groups",
            json={"name": "New Group", "description": "desc"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New Group"
        assert data["id"] is not None

    @pytest.mark.asyncio
    async def test_list_groups(self, client, admin_headers, group):
        resp = await client.get("/api/groups", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_get_group(self, client, admin_headers, group):
        resp = await client.get(f"/api/groups/{group.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Lab A Team"

    @pytest.mark.asyncio
    async def test_update_group(self, client, admin_headers, group):
        resp = await client.patch(
            f"/api/groups/{group.id}",
            json={"name": "Renamed"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    @pytest.mark.asyncio
    async def test_delete_group(self, client, admin_headers, group):
        resp = await client.delete(f"/api/groups/{group.id}", headers=admin_headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_get_nonexistent_group(self, client, admin_headers):
        resp = await client.get(f"/api/groups/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, client, regular_headers):
        resp = await client.get("/api/groups", headers=regular_headers)
        assert resp.status_code == 403


class TestGroupMembers:
    @pytest.mark.asyncio
    async def test_add_and_list_member(self, client, admin_headers, group, regular_user):
        # Add member
        resp = await client.post(
            f"/api/groups/{group.id}/members",
            json={"user_id": str(regular_user.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["user_id"] == str(regular_user.id)

        # List members
        resp = await client.get(
            f"/api/groups/{group.id}/members",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_add_duplicate_member(self, client, admin_headers, group, regular_user):
        await client.post(
            f"/api/groups/{group.id}/members",
            json={"user_id": str(regular_user.id)},
            headers=admin_headers,
        )
        resp = await client.post(
            f"/api/groups/{group.id}/members",
            json={"user_id": str(regular_user.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_member(self, client, admin_headers, group, regular_user):
        await client.post(
            f"/api/groups/{group.id}/members",
            json={"user_id": str(regular_user.id)},
            headers=admin_headers,
        )
        resp = await client.delete(
            f"/api/groups/{group.id}/members/{regular_user.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_nonexistent_member(self, client, admin_headers, group):
        resp = await client.delete(
            f"/api/groups/{group.id}/members/{uuid.uuid4()}",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_members_for_nonexistent_group(self, client, admin_headers):
        resp = await client.get(
            f"/api/groups/{uuid.uuid4()}/members",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_add_member_to_nonexistent_group(self, client, admin_headers, regular_user):
        resp = await client.post(
            f"/api/groups/{uuid.uuid4()}/members",
            json={"user_id": str(regular_user.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_nonexistent_group(self, client, admin_headers):
        resp = await client.patch(
            f"/api/groups/{uuid.uuid4()}",
            json={"name": "X"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_group(self, client, admin_headers):
        resp = await client.delete(
            f"/api/groups/{uuid.uuid4()}",
            headers=admin_headers,
        )
        assert resp.status_code == 404
