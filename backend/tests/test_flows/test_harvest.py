"""Tests for the harvest flow and tasks."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.file import FileRecord, PersistentIdType
from app.models.hook import HookConfig, HookImplementation, HookTrigger
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.models.schedule import HarvestSchedule
from app.models.storage import StorageLocation, StorageType
from app.models.transfer import FileTransfer, TransferStatus
from app.services.credentials import encrypt_value
from app.transfers.base import DiscoveredFile, TransferResult


@pytest.fixture
def mock_db_session(db_session):
    """Patch get_db_session to use the test session."""
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _mock_session():
        yield db_session

    with patch("app.flows.harvest.get_db_session", _mock_session):
        yield db_session


@pytest_asyncio.fixture
async def seed_data(db_session):
    """Seed test data for harvest tests."""
    sa = ServiceAccount(
        name="test-sa",
        domain="WORKGROUP",
        username="testuser",
        password_encrypted=encrypt_value("testpass"),
    )
    storage = StorageLocation(
        name="Test Storage",
        type=StorageType.posix,
        base_path="/tmp/test-storage",
        connection_config={},
        enabled=True,
    )
    db_session.add_all([sa, storage])
    await db_session.flush()

    instrument = Instrument(
        name="Test Instrument",
        cifs_host="test-host",
        cifs_share="test-share",
        cifs_base_path="/",
        service_account_id=sa.id,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    db_session.add(instrument)
    await db_session.flush()

    schedule = HarvestSchedule(
        instrument_id=instrument.id,
        default_storage_location_id=storage.id,
        cron_expression="*/15 * * * *",
        enabled=True,
    )
    db_session.add(schedule)
    await db_session.flush()

    return {
        "instrument": instrument,
        "schedule": schedule,
        "storage": storage,
        "service_account": sa,
    }


class TestDiscoverFilesTask:
    @pytest.mark.asyncio
    async def test_discovers_new_files(self, mock_db_session, seed_data):
        data = seed_data
        discovered = [
            DiscoveredFile(
                path="exp/image.tif",
                filename="image.tif",
                size_bytes=1024,
                mod_time=datetime.now(UTC),
            ),
        ]

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.discover.return_value = discovered
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import discover_files_task

            result = await discover_files_task.fn(
                str(data["instrument"].id), str(data["schedule"].id)
            )

        assert result["total_discovered"] == 1
        assert len(result["new_files"]) == 1
        assert result["new_files"][0]["path"] == "exp/image.tif"

    @pytest.mark.asyncio
    async def test_filters_known_files(self, mock_db_session, seed_data):
        data = seed_data
        # Pre-create a known file record
        known = FileRecord(
            persistent_id="ark:/99999/fk4test",
            persistent_id_type=PersistentIdType.ark,
            instrument_id=data["instrument"].id,
            source_path="exp/known.tif",
            filename="known.tif",
            first_discovered_at=datetime.now(UTC),
        )
        mock_db_session.add(known)
        await mock_db_session.flush()

        discovered = [
            DiscoveredFile(path="exp/known.tif", filename="known.tif", size_bytes=100),
            DiscoveredFile(path="exp/new.tif", filename="new.tif", size_bytes=200),
        ]

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.discover.return_value = discovered
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import discover_files_task

            result = await discover_files_task.fn(
                str(data["instrument"].id), str(data["schedule"].id)
            )

        assert result["total_discovered"] == 2
        assert len(result["new_files"]) == 1
        assert result["new_files"][0]["path"] == "exp/new.tif"


class TestTransferSingleFileTask:
    @pytest.mark.asyncio
    async def test_successful_transfer(self, mock_db_session, seed_data):
        data = seed_data

        file_info = {
            "path": "exp/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }

        transfer_result = TransferResult(
            success=True,
            source_path="exp/image.tif",
            destination_path="/tmp/test-storage/Test Instrument/exp/image.tif",
            bytes_transferred=1024,
            dest_checksum="abc123",
        )

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.transfer_file.return_value = transfer_result
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import transfer_single_file_task

            result = await transfer_single_file_task.fn(
                file_info=file_info,
                instrument_id=str(data["instrument"].id),
                instrument_name=data["instrument"].name,
                schedule_id=str(data["schedule"].id),
                storage_location_id=str(data["storage"].id),
            )

        assert result["status"] == "completed"
        assert result["persistent_id"].startswith("ark:/")

        # Verify DB records
        files = (await mock_db_session.execute(select(FileRecord))).scalars().all()
        assert len(files) == 1
        assert files[0].xxhash == "abc123"

        transfers = (await mock_db_session.execute(select(FileTransfer))).scalars().all()
        assert len(transfers) == 1
        assert transfers[0].status == TransferStatus.completed

    @pytest.mark.asyncio
    async def test_skip_by_pre_hook(self, mock_db_session, seed_data):
        data = seed_data

        # Add a file filter hook that skips .tmp files
        hook = HookConfig(
            name="skip-tmp",
            trigger=HookTrigger.pre_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="file_filter",
            config={"exclude_patterns": ["*.tmp"]},
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        mock_db_session.add(hook)
        await mock_db_session.flush()

        file_info = {
            "path": "exp/temp.tmp",
            "filename": "temp.tmp",
            "size_bytes": 100,
            "mod_time": None,
        }

        from app.flows.harvest import transfer_single_file_task

        result = await transfer_single_file_task.fn(
            file_info=file_info,
            instrument_id=str(data["instrument"].id),
            instrument_name=data["instrument"].name,
            schedule_id=str(data["schedule"].id),
            storage_location_id=str(data["storage"].id),
        )

        assert result["status"] == "skipped"

        transfers = (await mock_db_session.execute(select(FileTransfer))).scalars().all()
        assert len(transfers) == 1
        assert transfers[0].status == TransferStatus.skipped

    @pytest.mark.asyncio
    async def test_metadata_enrichment(self, mock_db_session, seed_data):
        data = seed_data

        hook = HookConfig(
            name="enrich",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="metadata_enrichment",
            config={
                "rules": [
                    {"pattern": r"(?P<experiment>exp_\d+)", "source": "path"},
                ]
            },
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        mock_db_session.add(hook)
        await mock_db_session.flush()

        file_info = {
            "path": "exp_001/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }

        transfer_result = TransferResult(
            success=True,
            source_path="exp_001/image.tif",
            destination_path="/tmp/dest/image.tif",
            bytes_transferred=1024,
            dest_checksum="abc",
        )

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.transfer_file.return_value = transfer_result
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import transfer_single_file_task

            result = await transfer_single_file_task.fn(
                file_info=file_info,
                instrument_id=str(data["instrument"].id),
                instrument_name=data["instrument"].name,
                schedule_id=str(data["schedule"].id),
                storage_location_id=str(data["storage"].id),
            )

        assert result["status"] == "completed"

        files = (await mock_db_session.execute(select(FileRecord))).scalars().all()
        assert files[0].metadata_.get("experiment") == "exp_001"

    @pytest.mark.asyncio
    async def test_transfer_failure(self, mock_db_session, seed_data):
        data = seed_data

        file_info = {
            "path": "exp/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }

        transfer_result = TransferResult(
            success=False,
            source_path="exp/image.tif",
            destination_path="/tmp/dest/image.tif",
            error_message="connection refused",
        )

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.transfer_file.return_value = transfer_result
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import transfer_single_file_task

            result = await transfer_single_file_task.fn(
                file_info=file_info,
                instrument_id=str(data["instrument"].id),
                instrument_name=data["instrument"].name,
                schedule_id=str(data["schedule"].id),
                storage_location_id=str(data["storage"].id),
            )

        assert result["status"] == "failed"

        transfers = (await mock_db_session.execute(select(FileTransfer))).scalars().all()
        assert transfers[0].status == TransferStatus.failed


class TestHarvestInstrumentFlow:
    @pytest.mark.asyncio
    async def test_full_flow_no_files(self, mock_db_session, seed_data):
        data = seed_data

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.discover.return_value = []
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import harvest_instrument_flow

            result = await harvest_instrument_flow.fn(
                str(data["instrument"].id), str(data["schedule"].id)
            )

        assert result["new_files"] == 0
        assert result["transferred"] == 0
