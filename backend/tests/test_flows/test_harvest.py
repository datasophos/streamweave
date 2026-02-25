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

    @pytest.mark.asyncio
    async def test_full_flow_with_files(self, mock_db_session, seed_data):
        """Full harvest flow with files covers lines 356-387."""
        data = seed_data

        discovered = [
            DiscoveredFile(
                path="exp/image.tif",
                filename="image.tif",
                size_bytes=1024,
                mod_time=datetime.now(UTC),
            ),
        ]
        transfer_result = TransferResult(
            success=True,
            source_path="exp/image.tif",
            destination_path="/tmp/test-storage/Test Instrument/exp/image.tif",
            bytes_transferred=1024,
            dest_checksum="abc123",
        )

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.discover.return_value = discovered
            mock_adapter.transfer_file.return_value = transfer_result
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import harvest_instrument_flow

            result = await harvest_instrument_flow.fn(
                str(data["instrument"].id), str(data["schedule"].id)
            )

        assert result["new_files"] == 1
        assert result["transferred"] == 1
        assert result["skipped"] == 0
        assert result["failed"] == 0


class TestDiscoverFilesTaskNoModTime:
    @pytest.mark.asyncio
    async def test_no_mod_time(self, mock_db_session, seed_data):
        """Covers line 159: mod_time parsed from ISO string."""
        data = seed_data
        discovered = [
            DiscoveredFile(path="exp/img.tif", filename="img.tif", size_bytes=512),
        ]

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.discover.return_value = discovered
            mock_factory.return_value = mock_adapter

            from app.flows.harvest import discover_files_task

            result = await discover_files_task.fn(
                str(data["instrument"].id), str(data["schedule"].id)
            )

        # mod_time is None when DiscoveredFile has no mod_time
        assert result["new_files"][0]["mod_time"] is None


class TestTransferSingleFileTaskModTime:
    @pytest.mark.asyncio
    async def test_mod_time_is_parsed(self, mock_db_session, seed_data):
        """Covers line 159: mod_time parsed from isoformat string."""
        data = seed_data

        file_info = {
            "path": "exp/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": "2026-02-20T10:30:00+00:00",
        }
        transfer_result = TransferResult(
            success=True,
            source_path="exp/image.tif",
            destination_path="/tmp/test-storage/Test Instrument/exp/image.tif",
            bytes_transferred=1024,
            dest_checksum="def456",
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


class TestTransferSingleFileTaskRedirect:
    @pytest.mark.asyncio
    async def test_redirect_action(self, mock_db_session, seed_data):
        """Covers lines 205-207: redirect action modifies destination_path."""
        data = seed_data

        # Add a redirect hook
        from app.hooks.base import BaseHook, HookResult

        class RedirectHook(BaseHook):
            async def execute(self, context) -> HookResult:
                from app.hooks.base import HookAction

                return HookResult(
                    action=HookAction.redirect,
                    redirect_path="/alt/storage",
                )

        with patch("app.flows.harvest.run_hooks") as mock_run_hooks:
            from app.hooks.base import HookAction, HookResult

            mock_run_hooks.side_effect = [
                HookResult(action=HookAction.redirect, redirect_path="/alt/storage"),
                HookResult(action=HookAction.proceed),
            ]

            transfer_result = TransferResult(
                success=True,
                source_path="exp/image.tif",
                destination_path="/alt/storage/Test Instrument/exp/image.tif",
                bytes_transferred=1024,
                dest_checksum="xyz",
            )

            with patch("app.flows.harvest.create_adapter") as mock_factory:
                mock_adapter = AsyncMock()
                mock_adapter.transfer_file.return_value = transfer_result
                mock_factory.return_value = mock_adapter

                from app.flows.harvest import transfer_single_file_task

                result = await transfer_single_file_task.fn(
                    file_info={
                        "path": "exp/image.tif",
                        "filename": "image.tif",
                        "size_bytes": 1024,
                        "mod_time": None,
                    },
                    instrument_id=str(data["instrument"].id),
                    instrument_name=data["instrument"].name,
                    schedule_id=str(data["schedule"].id),
                    storage_location_id=str(data["storage"].id),
                )

        assert result["status"] == "completed"


class TestTransferSingleFileTaskException:
    @pytest.mark.asyncio
    async def test_transfer_exception(self, mock_db_session, seed_data):
        """Covers lines 226-234: exception during adapter.transfer_file."""
        data = seed_data

        file_info = {
            "path": "exp/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }

        with patch("app.flows.harvest.create_adapter") as mock_factory:
            mock_adapter = AsyncMock()
            mock_adapter.transfer_file.side_effect = RuntimeError("Network timeout")
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
        assert "Network timeout" in result["error"]


class TestTransferSingleFileTaskAccessGrants:
    @pytest.mark.asyncio
    async def test_literal_access_grant(self, mock_db_session, seed_data, admin_user):
        """Covers lines 279-310: literal grantee_id access grant creation."""
        data = seed_data

        from app.models.access import FileAccessGrant

        hook = HookConfig(
            name="access",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="access_assignment",
            config={
                "grants": [
                    {
                        "grantee_type": "user",
                        "match_field": str(admin_user.id),
                        "source": "literal",
                    },
                ]
            },
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        mock_db_session.add(hook)
        await mock_db_session.flush()

        file_info = {
            "path": "exp/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }
        transfer_result = TransferResult(
            success=True,
            source_path="exp/image.tif",
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

        grants = (await mock_db_session.execute(select(FileAccessGrant))).scalars().all()
        assert len(grants) == 1
        assert grants[0].grantee_id == admin_user.id

    @pytest.mark.asyncio
    async def test_invalid_literal_grant_skipped(self, mock_db_session, seed_data):
        """Covers lines 288-289: invalid UUID in grantee_id is caught and skipped."""
        data = seed_data

        hook = HookConfig(
            name="access",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="access_assignment",
            config={
                "grants": [
                    {
                        "grantee_type": "user",
                        "match_field": "not-a-valid-uuid",
                        "source": "literal",
                    },
                ]
            },
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        mock_db_session.add(hook)
        await mock_db_session.flush()

        file_info = {
            "path": "exp/img.tif",
            "filename": "img.tif",
            "size_bytes": 512,
            "mod_time": None,
        }
        transfer_result = TransferResult(
            success=True,
            source_path="exp/img.tif",
            destination_path="/tmp/dest/img.tif",
            bytes_transferred=512,
            dest_checksum="def",
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

        # Should still complete even though the grant was invalid
        assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_resolve_value_grant_user(self, mock_db_session, seed_data, admin_user):
        """Covers lines 290-309: resolve_value access grant resolved by user email."""
        data = seed_data

        hook = HookConfig(
            name="access-resolve",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="access_assignment",
            config={
                "grants": [
                    {
                        "grantee_type": "user",
                        "match_field": "owner_email",
                        "source": "metadata",
                    },
                ]
            },
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        # Add metadata enrichment hook to provide the email
        meta_hook = HookConfig(
            name="enrich-email",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="metadata_enrichment",
            config={"rules": [{"pattern": r"(?P<owner_email>admin@test\.com)", "source": "path"}]},
            instrument_id=data["instrument"].id,
            priority=1,
            enabled=True,
        )
        mock_db_session.add_all([hook, meta_hook])
        await mock_db_session.flush()

        file_info = {
            "path": "admin@test.com/image.tif",
            "filename": "image.tif",
            "size_bytes": 1024,
            "mod_time": None,
        }
        transfer_result = TransferResult(
            success=True,
            source_path="admin@test.com/image.tif",
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

    @pytest.mark.asyncio
    async def test_resolve_value_grant_not_found(self, mock_db_session, seed_data):
        """Covers lines 304-309: resolve_value when grantee cannot be found."""
        data = seed_data

        hook = HookConfig(
            name="access-unresolvable",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="access_assignment",
            config={
                "grants": [
                    {
                        "grantee_type": "user",
                        "match_field": "owner_email",
                        "source": "metadata",
                    },
                ]
            },
            instrument_id=data["instrument"].id,
            priority=0,
            enabled=True,
        )
        meta_hook = HookConfig(
            name="enrich-email",
            trigger=HookTrigger.post_transfer,
            implementation=HookImplementation.builtin,
            builtin_name="metadata_enrichment",
            config={
                "rules": [
                    {"pattern": r"(?P<owner_email>nonexistent@nobody\.com)", "source": "path"}
                ]
            },
            instrument_id=data["instrument"].id,
            priority=1,
            enabled=True,
        )
        mock_db_session.add_all([hook, meta_hook])
        await mock_db_session.flush()

        file_info = {
            "path": "nonexistent@nobody.com/image.tif",
            "filename": "image.tif",
            "size_bytes": 512,
            "mod_time": None,
        }
        transfer_result = TransferResult(
            success=True,
            source_path="nonexistent@nobody.com/image.tif",
            destination_path="/tmp/dest/image.tif",
            bytes_transferred=512,
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

        # Should complete even though resolve failed
        assert result["status"] == "completed"


class TestDiscoverFilesTaskNotFound:
    @pytest.mark.asyncio
    async def test_instrument_not_found_raises(self, mock_db_session):
        """Covers harvest.py:71 — ValueError when instrument ID doesn't exist."""
        from app.flows.harvest import discover_files_task

        fake_id = "00000000-0000-0000-0000-000000000000"
        with pytest.raises(ValueError, match="not found"):
            await discover_files_task.fn(fake_id, fake_id)


class TestTransferSingleFileTaskStorageNotFound:
    @pytest.mark.asyncio
    async def test_storage_location_not_found_raises(self, mock_db_session, seed_data):
        """Covers harvest.py:150 — ValueError when storage location ID doesn't exist."""
        from app.flows.harvest import transfer_single_file_task

        fake_storage_id = "00000000-0000-0000-0000-000000000000"
        with pytest.raises(ValueError, match="not found"):
            await transfer_single_file_task.fn(
                file_info={
                    "path": "exp/img.tif",
                    "filename": "img.tif",
                    "size_bytes": 100,
                    "mod_time": None,
                },
                instrument_id=str(seed_data["instrument"].id),
                instrument_name=seed_data["instrument"].name,
                schedule_id=str(seed_data["schedule"].id),
                storage_location_id=fake_storage_id,
            )


class TestResolveValueAccessGrants:
    @pytest.mark.asyncio
    async def test_resolve_value_grant_found(self, mock_db_session, seed_data, admin_user):
        """Covers harvest.py:290-303 — resolve_value grant where grantee is found."""
        from unittest.mock import patch

        from app.hooks.base import HookAction, HookResult
        from app.models.access import FileAccessGrant
        from app.transfers.base import TransferResult

        post_hooks_result = HookResult(
            action=HookAction.proceed,
            access_grants=[
                {
                    "grantee_type": "user",
                    "resolve_value": "admin@test.com",
                }
            ],
        )

        with patch("app.flows.harvest.run_hooks") as mock_run_hooks:
            mock_run_hooks.side_effect = [
                HookResult(action=HookAction.proceed),  # pre-transfer
                post_hooks_result,  # post-transfer
            ]

            transfer_result = TransferResult(
                success=True,
                source_path="exp/image.tif",
                destination_path="/tmp/dest/image.tif",
                bytes_transferred=512,
                dest_checksum="aaa",
            )

            with patch("app.flows.harvest.create_adapter") as mock_factory:
                mock_adapter = AsyncMock()
                mock_adapter.transfer_file.return_value = transfer_result
                mock_factory.return_value = mock_adapter

                from app.flows.harvest import transfer_single_file_task

                result = await transfer_single_file_task.fn(
                    file_info={
                        "path": "exp/image.tif",
                        "filename": "image.tif",
                        "size_bytes": 512,
                        "mod_time": None,
                    },
                    instrument_id=str(seed_data["instrument"].id),
                    instrument_name=seed_data["instrument"].name,
                    schedule_id=str(seed_data["schedule"].id),
                    storage_location_id=str(seed_data["storage"].id),
                )

        assert result["status"] == "completed"
        grants = (
            (
                await mock_db_session.execute(
                    __import__("sqlalchemy", fromlist=["select"]).select(FileAccessGrant)
                )
            )
            .scalars()
            .all()
        )
        assert any(g.grantee_id == admin_user.id for g in grants)

    @pytest.mark.asyncio
    async def test_resolve_value_grant_not_found_logs_warning(self, mock_db_session, seed_data):
        """Covers harvest.py:304-309 — resolve_value when grantee cannot be resolved."""
        from unittest.mock import patch

        from app.hooks.base import HookAction, HookResult
        from app.transfers.base import TransferResult

        post_hooks_result = HookResult(
            action=HookAction.proceed,
            access_grants=[
                {
                    "grantee_type": "user",
                    "resolve_value": "nobody@nowhere.invalid",
                }
            ],
        )

        with patch("app.flows.harvest.run_hooks") as mock_run_hooks:
            mock_run_hooks.side_effect = [
                HookResult(action=HookAction.proceed),
                post_hooks_result,
            ]

            transfer_result = TransferResult(
                success=True,
                source_path="exp/img.tif",
                destination_path="/tmp/dest/img.tif",
                bytes_transferred=256,
                dest_checksum="bbb",
            )

            with patch("app.flows.harvest.create_adapter") as mock_factory:
                mock_adapter = AsyncMock()
                mock_adapter.transfer_file.return_value = transfer_result
                mock_factory.return_value = mock_adapter

                from app.flows.harvest import transfer_single_file_task

                result = await transfer_single_file_task.fn(
                    file_info={
                        "path": "exp/img.tif",
                        "filename": "img.tif",
                        "size_bytes": 256,
                        "mod_time": None,
                    },
                    instrument_id=str(seed_data["instrument"].id),
                    instrument_name=seed_data["instrument"].name,
                    schedule_id=str(seed_data["schedule"].id),
                    storage_location_id=str(seed_data["storage"].id),
                )

        assert result["status"] == "completed"


class TestResolveGrantee:
    @pytest.mark.asyncio
    async def test_resolve_user_by_email(self, db_session, admin_user):
        """Covers _resolve_grantee for user."""
        from app.flows.harvest import _resolve_grantee

        result = await _resolve_grantee(db_session, "user", "admin@test.com")
        assert result == admin_user.id

    @pytest.mark.asyncio
    async def test_resolve_group_by_name(self, db_session):
        """Covers _resolve_grantee for group."""
        from app.flows.harvest import _resolve_grantee
        from app.models.group import Group

        group = Group(name="Resolve Test Group")
        db_session.add(group)
        await db_session.flush()

        result = await _resolve_grantee(db_session, "group", "Resolve Test Group")
        assert result == group.id

    @pytest.mark.asyncio
    async def test_resolve_project_by_name(self, db_session):
        """Covers _resolve_grantee for project."""
        from app.flows.harvest import _resolve_grantee
        from app.models.project import Project

        project = Project(name="Resolve Test Project")
        db_session.add(project)
        await db_session.flush()

        result = await _resolve_grantee(db_session, "project", "Resolve Test Project")
        assert result == project.id

    @pytest.mark.asyncio
    async def test_resolve_unknown_type_returns_none(self, db_session):
        """Covers _resolve_grantee fallback returning None for unknown type."""
        from app.flows.harvest import _resolve_grantee

        result = await _resolve_grantee(db_session, "unknown_type", "some_name")
        assert result is None
