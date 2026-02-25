"""Tests for the file access grant API."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.models.file import FileRecord, PersistentIdType
from app.models.group import Group
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.models.project import Project
from app.services.credentials import encrypt_value


@pytest_asyncio.fixture
async def file_record(db_session):
    sa = ServiceAccount(
        name="test-sa", domain="WORKGROUP",
        username="user", password_encrypted=encrypt_value("pass"),
    )
    db_session.add(sa)
    await db_session.flush()

    instrument = Instrument(
        name="Test Instrument",
        cifs_host="test-host", cifs_share="test-share",
        service_account_id=sa.id,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    db_session.add(instrument)
    await db_session.flush()

    f = FileRecord(
        persistent_id="ark:/99999/fk4access0",
        persistent_id_type=PersistentIdType.ark,
        instrument_id=instrument.id,
        source_path="exp/image.tif",
        filename="image.tif",
        size_bytes=1024,
        first_discovered_at=datetime.now(timezone.utc),
    )
    db_session.add(f)
    await db_session.flush()
    return f


class TestFileAccessGrants:
    @pytest.mark.asyncio
    async def test_grant_user_access(self, client, admin_headers, file_record, regular_user):
        resp = await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "user", "grantee_id": str(regular_user.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["grantee_type"] == "user"
        assert data["grantee_id"] == str(regular_user.id)
        assert data["file_id"] == str(file_record.id)

    @pytest.mark.asyncio
    async def test_grant_group_access(self, client, admin_headers, file_record, db_session):
        group = Group(name="Test Group")
        db_session.add(group)
        await db_session.flush()

        resp = await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "group", "grantee_id": str(group.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["grantee_type"] == "group"

    @pytest.mark.asyncio
    async def test_grant_project_access(self, client, admin_headers, file_record, db_session):
        project = Project(name="Test Project")
        db_session.add(project)
        await db_session.flush()

        resp = await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "project", "grantee_id": str(project.id)},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["grantee_type"] == "project"

    @pytest.mark.asyncio
    async def test_list_grants(self, client, admin_headers, file_record, regular_user):
        await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "user", "grantee_id": str(regular_user.id)},
            headers=admin_headers,
        )
        resp = await client.get(
            f"/api/files/{file_record.id}/access", headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_revoke_grant(self, client, admin_headers, file_record, regular_user):
        resp = await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "user", "grantee_id": str(regular_user.id)},
            headers=admin_headers,
        )
        grant_id = resp.json()["id"]

        resp = await client.delete(
            f"/api/files/{file_record.id}/access/{grant_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 204

        # Verify grant removed
        resp = await client.get(
            f"/api/files/{file_record.id}/access", headers=admin_headers,
        )
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_grant(self, client, admin_headers, file_record):
        resp = await client.delete(
            f"/api/files/{file_record.id}/access/{uuid.uuid4()}",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_nonexistent_file_404(self, client, admin_headers):
        resp = await client.get(
            f"/api/files/{uuid.uuid4()}/access", headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, client, regular_headers, file_record):
        resp = await client.get(
            f"/api/files/{file_record.id}/access", headers=regular_headers,
        )
        assert resp.status_code == 403


class TestAccessIntegration:
    """Test that grants actually affect file visibility."""

    @pytest.mark.asyncio
    async def test_user_grant_gives_access(
        self, client, admin_headers, regular_headers, file_record, regular_user,
    ):
        # No access initially
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 404

        # Grant access
        await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "user", "grantee_id": str(regular_user.id)},
            headers=admin_headers,
        )

        # Now accessible
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_group_grant_gives_access(
        self, client, admin_headers, regular_headers, file_record, regular_user, db_session,
    ):
        # Create group and add user
        group = Group(name="Test Group")
        db_session.add(group)
        await db_session.flush()

        from app.models.group import GroupMembership

        membership = GroupMembership(group_id=group.id, user_id=regular_user.id)
        db_session.add(membership)
        await db_session.flush()

        # No access initially
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 404

        # Grant group access
        await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "group", "grantee_id": str(group.id)},
            headers=admin_headers,
        )

        # Now accessible
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_project_grant_gives_access_via_user(
        self, client, admin_headers, regular_headers, file_record, regular_user, db_session,
    ):
        # Create project with user as direct member
        project = Project(name="Test Project")
        db_session.add(project)
        await db_session.flush()

        from app.models.project import MemberType, ProjectMembership

        pm = ProjectMembership(
            project_id=project.id, member_type=MemberType.user, member_id=regular_user.id,
        )
        db_session.add(pm)
        await db_session.flush()

        # Grant project access to file
        await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "project", "grantee_id": str(project.id)},
            headers=admin_headers,
        )

        # User can see file
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_project_grant_gives_access_via_group(
        self, client, admin_headers, regular_headers, file_record, regular_user, db_session,
    ):
        # Create group, add user to group
        group = Group(name="Team")
        db_session.add(group)
        await db_session.flush()

        from app.models.group import GroupMembership

        gm = GroupMembership(group_id=group.id, user_id=regular_user.id)
        db_session.add(gm)
        await db_session.flush()

        # Create project, add group as member
        project = Project(name="Research Project")
        db_session.add(project)
        await db_session.flush()

        from app.models.project import MemberType, ProjectMembership

        pm = ProjectMembership(
            project_id=project.id, member_type=MemberType.group, member_id=group.id,
        )
        db_session.add(pm)
        await db_session.flush()

        # Grant project access to file
        await client.post(
            f"/api/files/{file_record.id}/access",
            json={"grantee_type": "project", "grantee_id": str(project.id)},
            headers=admin_headers,
        )

        # User can see file (via group → project)
        resp = await client.get(f"/api/files/{file_record.id}", headers=regular_headers)
        assert resp.status_code == 200
