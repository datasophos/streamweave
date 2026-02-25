"""Tests for the rclone transfer adapter."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.transfers.rclone import RcloneAdapter


@pytest.fixture
def adapter():
    a = RcloneAdapter(
        rclone_binary="rclone",
        smb_host="microscope-01",
        smb_share="microscope",
        smb_base_path="/",
        smb_user="labuser",
        smb_password="labpass",
        smb_domain="WORKGROUP",
    )
    # Pre-set obscured password so tests don't need rclone binary
    a._obscured_password = "obscured-labpass"
    return a


class TestRemotePath:
    def test_root(self, adapter):
        assert adapter._remote_path() == ":smb:/"

    def test_with_subpath(self, adapter):
        assert adapter._remote_path("data/file.tif") == ":smb:/data/file.tif"

    def test_custom_base_path(self):
        a = RcloneAdapter(
            smb_host="h",
            smb_share="s",
            smb_base_path="/export/data",
            smb_user="u",
            smb_password="p",
        )
        assert a._remote_path("file.txt") == ":smb:/export/data/file.txt"


class TestBaseFlags:
    def test_contains_required_flags(self, adapter):
        flags = adapter._base_flags()
        assert "--smb-host" in flags
        assert "microscope-01" in flags
        assert "--smb-user" in flags
        assert "labuser" in flags
        assert "--smb-domain" in flags
        assert "WORKGROUP" in flags


class TestDiscover:
    @pytest.mark.asyncio
    async def test_parses_lsjson_output(self, adapter):
        lsjson_output = json.dumps(
            [
                {
                    "Path": "experiment_001/image_001.tif",
                    "Name": "image_001.tif",
                    "Size": 1048576,
                    "ModTime": "2026-02-20T10:30:00Z",
                    "IsDir": False,
                },
                {
                    "Path": "experiment_001",
                    "Name": "experiment_001",
                    "Size": 0,
                    "IsDir": True,
                },
                {
                    "Path": "experiment_001/notes.txt",
                    "Name": "notes.txt",
                    "Size": 256,
                    "ModTime": "2026-02-20T11:00:00Z",
                    "IsDir": False,
                },
            ]
        )

        with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = (0, lsjson_output, "")
            files = await adapter.discover()

        assert len(files) == 2  # Directories excluded
        assert files[0].path == "experiment_001/image_001.tif"
        assert files[0].filename == "image_001.tif"
        assert files[0].size_bytes == 1048576
        assert files[0].mod_time is not None
        assert files[1].path == "experiment_001/notes.txt"

    @pytest.mark.asyncio
    async def test_discover_command_construction(self, adapter):
        with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = (0, "[]", "")
            await adapter.discover()

        args = mock_run.call_args[0][0]
        assert args[0] == "rclone"
        assert args[1] == "lsjson"
        assert "--recursive" in args
        assert ":smb:/" in args

    @pytest.mark.asyncio
    async def test_discover_failure_raises(self, adapter):
        with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = (1, "", "connection refused")
            with pytest.raises(RuntimeError, match="rclone lsjson failed"):
                await adapter.discover()


class TestTransferFile:
    @pytest.mark.asyncio
    async def test_successful_transfer(self, adapter):
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = str(Path(tmpdir) / "output" / "file.tif")
            # Create the dest file to simulate rclone writing it
            Path(dest).parent.mkdir(parents=True)
            Path(dest).write_bytes(b"fake image data")

            with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
                mock_run.return_value = (0, "", "")
                result = await adapter.transfer_file("data/file.tif", dest)

            assert result.success is True
            assert result.bytes_transferred == 15
            assert result.dest_checksum != ""

    @pytest.mark.asyncio
    async def test_transfer_failure(self, adapter):
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = str(Path(tmpdir) / "file.tif")
            with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
                mock_run.return_value = (1, "", "permission denied")
                result = await adapter.transfer_file("data/file.tif", dest)

            assert result.success is False
            assert "permission denied" in result.error_message

    @pytest.mark.asyncio
    async def test_transfer_command_construction(self, adapter):
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = str(Path(tmpdir) / "file.tif")
            # Create dest so checksum works
            Path(dest).write_bytes(b"data")

            with patch.object(adapter, "_run", new_callable=AsyncMock) as mock_run:
                mock_run.return_value = (0, "", "")
                await adapter.transfer_file("data/file.tif", dest)

            args = mock_run.call_args[0][0]
            assert args[0] == "rclone"
            assert args[1] == "copyto"
            assert ":smb:/data/file.tif" in args
            assert dest in args


class TestChecksum:
    @pytest.mark.asyncio
    async def test_computes_xxhash(self, adapter):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"hello world")
            path = f.name

        result = await adapter.checksum(path)
        Path(path).unlink()

        assert isinstance(result, str)
        assert len(result) == 16  # xxh64 hex digest
