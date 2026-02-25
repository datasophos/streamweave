"""Tests for the file transfers read API."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.models.file import FileRecord, PersistentIdType
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.models.storage import StorageLocation, StorageType
from app.models.transfer import FileTransfer, TransferStatus
from app.services.credentials import encrypt_value


@pytest_asyncio.fixture
async def transfer_data(db_session):
    """Create instrument, file, storage, and transfer records."""
    sa = ServiceAccount(
        name="test-sa", domain="WORKGROUP",
        username="user", password_encrypted=encrypt_value("pass"),
    )
    storage = StorageLocation(
        name="Test Storage", type=StorageType.posix,
        base_path="/tmp/test", connection_config={}, enabled=True,
    )
    db_session.add_all([sa, storage])
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

    file_record = FileRecord(
        persistent_id="ark:/99999/fk4xfer0",
        persistent_id_type=PersistentIdType.ark,
        instrument_id=instrument.id,
        source_path="exp/image.tif",
        filename="image.tif",
        size_bytes=2048,
        first_discovered_at=datetime.now(timezone.utc),
    )
    db_session.add(file_record)
    await db_session.flush()

    transfer = FileTransfer(
        file_id=file_record.id,
        storage_location_id=storage.id,
        destination_path="/tmp/test/image.tif",
        transfer_adapter=TransferAdapterType.rclone,
        status=TransferStatus.completed,
        bytes_transferred=2048,
        dest_checksum="abc123",
        checksum_verified=True,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(transfer)
    await db_session.flush()

    return {
        "instrument": instrument,
        "file": file_record,
        "transfer": transfer,
        "storage": storage,
    }


class TestListTransfers:
    @pytest.mark.asyncio
    async def test_admin_sees_all(self, client, admin_headers, transfer_data):
        resp = await client.get("/api/transfers", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_user_sees_accessible(
        self, client, regular_headers, transfer_data, grant_file_access,
    ):
        data = transfer_data
        await grant_file_access(data["file"].id)
        resp = await client.get("/api/transfers", headers=regular_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_user_sees_nothing_without_access(
        self, client, regular_headers, transfer_data,
    ):
        resp = await client.get("/api/transfers", headers=regular_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    @pytest.mark.asyncio
    async def test_filter_by_file_id(self, client, admin_headers, transfer_data):
        data = transfer_data
        resp = await client.get(
            f"/api/transfers?file_id={data['file'].id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetTransfer:
    @pytest.mark.asyncio
    async def test_admin_gets_transfer(self, client, admin_headers, transfer_data):
        data = transfer_data
        resp = await client.get(
            f"/api/transfers/{data['transfer'].id}", headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    @pytest.mark.asyncio
    async def test_user_gets_accessible_transfer(
        self, client, regular_headers, transfer_data, grant_file_access,
    ):
        data = transfer_data
        await grant_file_access(data["file"].id)
        resp = await client.get(
            f"/api/transfers/{data['transfer'].id}", headers=regular_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_user_gets_404_without_access(
        self, client, regular_headers, transfer_data,
    ):
        data = transfer_data
        resp = await client.get(
            f"/api/transfers/{data['transfer'].id}", headers=regular_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_nonexistent_transfer_404(self, client, admin_headers):
        resp = await client.get(f"/api/transfers/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404
