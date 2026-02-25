"""Tests for the file records read API."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.models.file import FileRecord, PersistentIdType
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.services.credentials import encrypt_value


@pytest_asyncio.fixture
async def instrument_with_files(db_session):
    """Create an instrument with file records."""
    sa = ServiceAccount(
        name="test-sa", domain="WORKGROUP",
        username="user", password_encrypted=encrypt_value("pass"),
    )
    db_session.add(sa)
    await db_session.flush()

    instrument = Instrument(
        name="Test Microscope",
        cifs_host="test-host", cifs_share="test-share",
        service_account_id=sa.id,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    db_session.add(instrument)
    await db_session.flush()

    files = []
    for i in range(3):
        f = FileRecord(
            persistent_id=f"ark:/99999/fk4test{i}",
            persistent_id_type=PersistentIdType.ark,
            instrument_id=instrument.id,
            source_path=f"exp/image_{i}.tif",
            filename=f"image_{i}.tif",
            size_bytes=1024 * (i + 1),
            first_discovered_at=datetime.now(timezone.utc),
        )
        files.append(f)
    db_session.add_all(files)
    await db_session.flush()

    return {"instrument": instrument, "files": files}


class TestListFiles:
    @pytest.mark.asyncio
    async def test_admin_sees_all(self, client, admin_headers, instrument_with_files):
        resp = await client.get("/api/files", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    @pytest.mark.asyncio
    async def test_user_sees_only_accessible(
        self, client, regular_headers, instrument_with_files, grant_file_access,
    ):
        data = instrument_with_files
        # Grant access to all 3 files
        for f in data["files"]:
            await grant_file_access(f.id)

        resp = await client.get("/api/files", headers=regular_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    @pytest.mark.asyncio
    async def test_user_sees_nothing_without_access(
        self, client, regular_headers, instrument_with_files,
    ):
        resp = await client.get("/api/files", headers=regular_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_user_sees_owned_files(
        self, client, regular_headers, regular_user, instrument_with_files,
    ):
        data = instrument_with_files
        # Set owner on first file
        data["files"][0].owner_id = regular_user.id

        resp = await client.get("/api/files", headers=regular_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_filter_by_instrument_id(self, client, admin_headers, instrument_with_files):
        data = instrument_with_files
        resp = await client.get(
            f"/api/files?instrument_id={data['instrument'].id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    @pytest.mark.asyncio
    async def test_unauthenticated_rejected(self, client, instrument_with_files):
        resp = await client.get("/api/files")
        assert resp.status_code == 401


class TestGetFile:
    @pytest.mark.asyncio
    async def test_admin_gets_file(self, client, admin_headers, instrument_with_files):
        data = instrument_with_files
        file_id = data["files"][0].id
        resp = await client.get(f"/api/files/{file_id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["persistent_id"] == "ark:/99999/fk4test0"

    @pytest.mark.asyncio
    async def test_user_gets_accessible_file(
        self, client, regular_headers, instrument_with_files, grant_file_access,
    ):
        data = instrument_with_files
        file_id = data["files"][0].id
        await grant_file_access(file_id)
        resp = await client.get(f"/api/files/{file_id}", headers=regular_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_user_gets_404_without_access(
        self, client, regular_headers, instrument_with_files,
    ):
        data = instrument_with_files
        file_id = data["files"][0].id
        resp = await client.get(f"/api/files/{file_id}", headers=regular_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_nonexistent_file_404(self, client, admin_headers):
        resp = await client.get(f"/api/files/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404
