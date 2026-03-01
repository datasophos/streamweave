"""Tests for the admin users list endpoint."""

import uuid

import pytest
import pytest_asyncio

from app.models.group import Group, GroupMembership
from app.models.project import MemberType, Project, ProjectMembership


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


class TestListUserGroups:
    @pytest_asyncio.fixture
    async def group_with_member(self, db_session, regular_user):
        group = Group(name="Test Group", description="A group")
        db_session.add(group)
        await db_session.flush()
        membership = GroupMembership(group_id=group.id, user_id=regular_user.id)
        db_session.add(membership)
        await db_session.flush()
        return group

    @pytest.mark.asyncio
    async def test_list_user_groups(self, client, admin_headers, regular_user, group_with_member):
        resp = await client.get(f"/api/admin/users/{regular_user.id}/groups", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == str(group_with_member.id)
        assert data[0]["name"] == "Test Group"

    @pytest.mark.asyncio
    async def test_list_user_groups_empty(self, client, admin_headers, regular_user):
        resp = await client.get(f"/api/admin/users/{regular_user.id}/groups", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_user_groups_excludes_deleted_groups(
        self, client, admin_headers, regular_user, group_with_member
    ):
        # Soft-delete the group
        await client.delete(f"/api/groups/{group_with_member.id}", headers=admin_headers)
        resp = await client.get(f"/api/admin/users/{regular_user.id}/groups", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_user_groups_nonexistent_user(self, client, admin_headers):
        resp = await client.get(f"/api/admin/users/{uuid.uuid4()}/groups", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_user_groups_non_admin_rejected(self, client, regular_headers, regular_user):
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/groups", headers=regular_headers
        )
        assert resp.status_code == 403


class TestListUserProjects:
    @pytest_asyncio.fixture
    async def project_with_direct_member(self, db_session, regular_user):
        project = Project(name="Direct Project", description="A project")
        db_session.add(project)
        await db_session.flush()
        membership = ProjectMembership(
            project_id=project.id, member_type=MemberType.user, member_id=regular_user.id
        )
        db_session.add(membership)
        await db_session.flush()
        return project

    @pytest_asyncio.fixture
    async def project_with_group_member(self, db_session, regular_user):
        group = Group(name="Group For Project", description="")
        db_session.add(group)
        await db_session.flush()
        db_session.add(GroupMembership(group_id=group.id, user_id=regular_user.id))
        project = Project(name="Group Project", description="A project via group")
        db_session.add(project)
        await db_session.flush()
        db_session.add(
            ProjectMembership(
                project_id=project.id, member_type=MemberType.group, member_id=group.id
            )
        )
        await db_session.flush()
        return project

    @pytest.mark.asyncio
    async def test_list_user_projects(
        self, client, admin_headers, regular_user, project_with_direct_member
    ):
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/projects", headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == str(project_with_direct_member.id)
        assert data[0]["name"] == "Direct Project"

    @pytest.mark.asyncio
    async def test_list_user_projects_excludes_group_memberships(
        self, client, admin_headers, regular_user, project_with_group_member
    ):
        # Admin endpoint shows only direct (user-type) memberships
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/projects", headers=admin_headers
        )
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_user_projects_empty(self, client, admin_headers, regular_user):
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/projects", headers=admin_headers
        )
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_user_projects_excludes_deleted(
        self, client, admin_headers, regular_user, project_with_direct_member
    ):
        await client.delete(f"/api/projects/{project_with_direct_member.id}", headers=admin_headers)
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/projects", headers=admin_headers
        )
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_user_projects_nonexistent_user(self, client, admin_headers):
        resp = await client.get(f"/api/admin/users/{uuid.uuid4()}/projects", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_user_projects_non_admin_rejected(
        self, client, regular_headers, regular_user
    ):
        resp = await client.get(
            f"/api/admin/users/{regular_user.id}/projects", headers=regular_headers
        )
        assert resp.status_code == 403
