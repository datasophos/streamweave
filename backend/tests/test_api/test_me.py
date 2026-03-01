"""Tests for the /api/me endpoint."""

import pytest
import pytest_asyncio

from app.models.group import Group, GroupMembership
from app.models.project import MemberType, Project, ProjectMembership


class TestMeEndpoint:
    @pytest.mark.asyncio
    async def test_me_returns_user_info(self, client, regular_headers, regular_user):
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(regular_user.id)
        assert data["email"] == regular_user.email
        assert "groups" in data
        assert "projects" in data

    @pytest.mark.asyncio
    async def test_me_unauthenticated(self, client):
        resp = await client.get("/api/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_me_empty_memberships(self, client, regular_headers):
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["groups"] == []
        assert data["projects"] == []

    @pytest_asyncio.fixture
    async def user_in_group(self, db_session, regular_user):
        group = Group(name="My Group", description="")
        db_session.add(group)
        await db_session.flush()
        db_session.add(GroupMembership(group_id=group.id, user_id=regular_user.id))
        await db_session.flush()
        return group

    @pytest_asyncio.fixture
    async def direct_project(self, db_session, regular_user):
        project = Project(name="Direct Project", description="")
        db_session.add(project)
        await db_session.flush()
        db_session.add(
            ProjectMembership(
                project_id=project.id, member_type=MemberType.user, member_id=regular_user.id
            )
        )
        await db_session.flush()
        return project

    @pytest_asyncio.fixture
    async def group_project(self, db_session, user_in_group):
        project = Project(name="Group Project", description="")
        db_session.add(project)
        await db_session.flush()
        db_session.add(
            ProjectMembership(
                project_id=project.id,
                member_type=MemberType.group,
                member_id=user_in_group.id,
            )
        )
        await db_session.flush()
        return project

    @pytest.mark.asyncio
    async def test_me_returns_direct_group(self, client, regular_headers, user_in_group):
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        groups = resp.json()["groups"]
        assert len(groups) == 1
        assert groups[0]["id"] == str(user_in_group.id)

    @pytest.mark.asyncio
    async def test_me_returns_direct_project(self, client, regular_headers, direct_project):
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        projects = resp.json()["projects"]
        assert len(projects) == 1
        assert projects[0]["id"] == str(direct_project.id)

    @pytest.mark.asyncio
    async def test_me_returns_project_via_group(
        self, client, regular_headers, user_in_group, group_project
    ):
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        projects = resp.json()["projects"]
        assert len(projects) == 1
        assert projects[0]["id"] == str(group_project.id)

    @pytest.mark.asyncio
    async def test_me_deduplicates_projects(
        self, client, regular_headers, regular_user, db_session, user_in_group
    ):
        # User is both a direct member and via group — project should appear once
        project = Project(name="Dual Project", description="")
        db_session.add(project)
        await db_session.flush()
        db_session.add(
            ProjectMembership(
                project_id=project.id, member_type=MemberType.user, member_id=regular_user.id
            )
        )
        db_session.add(
            ProjectMembership(
                project_id=project.id,
                member_type=MemberType.group,
                member_id=user_in_group.id,
            )
        )
        await db_session.flush()

        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        projects = resp.json()["projects"]
        assert len(projects) == 1

    @pytest.mark.asyncio
    async def test_me_excludes_deleted_group(
        self, client, regular_headers, admin_headers, user_in_group
    ):
        await client.delete(f"/api/groups/{user_in_group.id}", headers=admin_headers)
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        assert resp.json()["groups"] == []

    @pytest.mark.asyncio
    async def test_me_excludes_deleted_project(
        self, client, regular_headers, admin_headers, direct_project
    ):
        await client.delete(f"/api/projects/{direct_project.id}", headers=admin_headers)
        resp = await client.get("/api/me", headers=regular_headers)
        assert resp.status_code == 200
        assert resp.json()["projects"] == []
