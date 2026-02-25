"""Tests for the projects CRUD API."""

import uuid

import pytest
import pytest_asyncio

from app.models.group import Group
from app.models.project import Project


@pytest_asyncio.fixture
async def project(db_session):
    p = Project(name="Project Alpha", description="Main research project")
    db_session.add(p)
    await db_session.flush()
    return p


@pytest_asyncio.fixture
async def group(db_session):
    g = Group(name="Lab A Team")
    db_session.add(g)
    await db_session.flush()
    return g


class TestProjectsCRUD:
    @pytest.mark.asyncio
    async def test_create_project(self, client, admin_headers):
        resp = await client.post(
            "/api/projects",
            json={"name": "New Project", "description": "desc"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "New Project"

    @pytest.mark.asyncio
    async def test_list_projects(self, client, admin_headers, project):
        resp = await client.get("/api/projects", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_get_project(self, client, admin_headers, project):
        resp = await client.get(f"/api/projects/{project.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Project Alpha"

    @pytest.mark.asyncio
    async def test_update_project(self, client, admin_headers, project):
        resp = await client.patch(
            f"/api/projects/{project.id}",
            json={"name": "Renamed"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    @pytest.mark.asyncio
    async def test_delete_project(self, client, admin_headers, project):
        resp = await client.delete(f"/api/projects/{project.id}", headers=admin_headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, client, regular_headers):
        resp = await client.get("/api/projects", headers=regular_headers)
        assert resp.status_code == 403


class TestProjectMembers:
    @pytest.mark.asyncio
    async def test_add_user_member(self, client, admin_headers, project, regular_user):
        resp = await client.post(
            f"/api/projects/{project.id}/members",
            json={"member_type": "user", "member_id": str(regular_user.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["member_type"] == "user"
        assert data["member_id"] == str(regular_user.id)

    @pytest.mark.asyncio
    async def test_add_group_member(self, client, admin_headers, project, group):
        resp = await client.post(
            f"/api/projects/{project.id}/members",
            json={"member_type": "group", "member_id": str(group.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["member_type"] == "group"

    @pytest.mark.asyncio
    async def test_list_members(self, client, admin_headers, project, regular_user):
        await client.post(
            f"/api/projects/{project.id}/members",
            json={"member_type": "user", "member_id": str(regular_user.id)},
            headers=admin_headers,
        )
        resp = await client.get(
            f"/api/projects/{project.id}/members", headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_add_duplicate_member(self, client, admin_headers, project, regular_user):
        payload = {"member_type": "user", "member_id": str(regular_user.id)}
        await client.post(
            f"/api/projects/{project.id}/members", json=payload, headers=admin_headers,
        )
        resp = await client.post(
            f"/api/projects/{project.id}/members", json=payload, headers=admin_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_member(self, client, admin_headers, project, regular_user):
        await client.post(
            f"/api/projects/{project.id}/members",
            json={"member_type": "user", "member_id": str(regular_user.id)},
            headers=admin_headers,
        )
        resp = await client.delete(
            f"/api/projects/{project.id}/members/{regular_user.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_nonexistent_member(self, client, admin_headers, project):
        resp = await client.delete(
            f"/api/projects/{project.id}/members/{uuid.uuid4()}",
            headers=admin_headers,
        )
        assert resp.status_code == 404
