"""Tests for app.services.storage_test."""

from __future__ import annotations

import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.services.storage_test as svc

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_rclone_proc(returncode: int, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock()
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(stdout.encode(), stderr.encode()))
    return proc


def _async_mock_exec(*procs):
    """Return an AsyncMock that yields each proc in order."""
    return AsyncMock(side_effect=list(procs))


# ---------------------------------------------------------------------------
# test_posix
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_posix_success():
    with tempfile.TemporaryDirectory() as tmp:
        ok, msg = await svc.test_posix(tmp)
    assert ok is True
    assert msg == "ok"


@pytest.mark.asyncio
async def test_posix_nonexistent_path():
    ok, msg = await svc.test_posix("/no/such/path/xyz")
    assert ok is False
    assert "does not exist" in msg


@pytest.mark.asyncio
async def test_posix_not_writable():
    with tempfile.TemporaryDirectory() as tmp:
        os.chmod(tmp, 0o444)
        try:
            ok, msg = await svc.test_posix(tmp)
            assert ok is False
            assert "readable/writable" in msg
        finally:
            os.chmod(tmp, 0o755)


# ---------------------------------------------------------------------------
# test_s3
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_s3_success():
    config = {
        "bucket": "my-bucket",
        "region": "us-east-1",
        "access_key_id": "AKIA",
        "secret_access_key": "enc-secret",
    }
    with (
        patch("app.services.storage_test.decrypt_value", return_value="plaintext-secret"),
        patch(
            "asyncio.create_subprocess_exec",
            new=_async_mock_exec(_make_rclone_proc(0)),
        ),
    ):
        ok, msg = await svc.test_s3(config, "s3://my-bucket/data")
    assert ok is True
    assert msg == "ok"


@pytest.mark.asyncio
async def test_s3_with_endpoint_url():
    config = {
        "bucket": "my-bucket",
        "region": "us-east-1",
        "endpoint_url": "https://s3.example.com",
        "access_key_id": "AKIA",
        "secret_access_key": "enc-secret",
    }
    mock_exec = _async_mock_exec(_make_rclone_proc(0))

    with (
        patch("app.services.storage_test.decrypt_value", return_value="plaintext-secret"),
        patch("asyncio.create_subprocess_exec", new=mock_exec),
    ):
        ok, _ = await svc.test_s3(config, "s3://my-bucket/data")

    assert ok is True
    call_args = mock_exec.call_args[0]
    assert "--s3-endpoint" in call_args
    assert "https://s3.example.com" in call_args
    assert "--s3-provider" in call_args
    assert "Other" in call_args


@pytest.mark.asyncio
async def test_s3_no_s3_provider_without_endpoint():
    """--s3-provider should not be added for plain AWS (no endpoint_url)."""
    config = {
        "bucket": "my-bucket",
        "region": "us-east-1",
        "access_key_id": "AKIA",
        "secret_access_key": "enc-secret",
    }
    mock_exec = _async_mock_exec(_make_rclone_proc(0))
    with (
        patch("app.services.storage_test.decrypt_value", return_value="plaintext-secret"),
        patch("asyncio.create_subprocess_exec", new=mock_exec),
    ):
        ok, _ = await svc.test_s3(config, "s3://my-bucket/data")
    assert ok is True
    call_args = mock_exec.call_args[0]
    assert "--s3-provider" not in call_args


@pytest.mark.asyncio
async def test_s3_rclone_failure():
    config = {
        "bucket": "bad-bucket",
        "region": "us-east-1",
        "access_key_id": "AKIA",
        "secret_access_key": "enc-secret",
    }
    with (
        patch("app.services.storage_test.decrypt_value", return_value="plaintext-secret"),
        patch(
            "asyncio.create_subprocess_exec",
            new=_async_mock_exec(_make_rclone_proc(1, stderr="NoSuchBucket")),
        ),
    ):
        ok, msg = await svc.test_s3(config, "s3://bad-bucket/data")
    assert ok is False
    assert "rclone lsd failed" in msg


@pytest.mark.asyncio
async def test_s3_no_region():
    """Region is optional; no --s3-region flag should appear when empty."""
    config = {
        "bucket": "my-bucket",
        "region": "",
        "access_key_id": "AKIA",
        "secret_access_key": "enc-secret",
    }
    mock_exec = _async_mock_exec(_make_rclone_proc(0))
    with (
        patch("app.services.storage_test.decrypt_value", return_value="secret"),
        patch("asyncio.create_subprocess_exec", new=mock_exec),
    ):
        ok, _ = await svc.test_s3(config, "s3://my-bucket/data")
    assert ok is True
    call_args = mock_exec.call_args[0]
    assert "--s3-region" not in call_args


@pytest.mark.asyncio
async def test_s3_decrypt_failure():
    config = {
        "bucket": "my-bucket",
        "region": "us-east-1",
        "access_key_id": "AKIA",
        "secret_access_key": "not-encrypted",
    }
    with patch("app.services.storage_test.decrypt_value", side_effect=Exception("bad token")):
        ok, msg = await svc.test_s3(config, "s3://my-bucket/data")
    assert ok is False
    assert "decrypt" in msg.lower()


# ---------------------------------------------------------------------------
# test_cifs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cifs_success():
    config = {
        "host": "fileserver.lab.local",
        "share": "data",
        "username": "labuser",
        "password": "enc-password",
    }
    with (
        patch("app.services.storage_test.decrypt_value", return_value="plaintext-pw"),
        patch(
            "asyncio.create_subprocess_exec",
            new=_async_mock_exec(
                _make_rclone_proc(0, stdout="obscured-pw"),
                _make_rclone_proc(0),
            ),
        ),
    ):
        ok, msg = await svc.test_cifs(config)
    assert ok is True
    assert msg == "ok"


@pytest.mark.asyncio
async def test_cifs_with_domain():
    config = {
        "host": "fileserver",
        "share": "data",
        "domain": "CORP",
        "username": "user",
        "password": "enc-pw",
    }
    mock_exec = _async_mock_exec(
        _make_rclone_proc(0, stdout="obs"),
        _make_rclone_proc(0),
    )
    with (
        patch("app.services.storage_test.decrypt_value", return_value="pw"),
        patch("asyncio.create_subprocess_exec", new=mock_exec),
    ):
        ok, _ = await svc.test_cifs(config)

    assert ok is True
    lsd_call_args = mock_exec.call_args_list[1][0]
    assert "CORP" in lsd_call_args


@pytest.mark.asyncio
async def test_cifs_lsd_failure():
    config = {
        "host": "fileserver",
        "share": "data",
        "username": "user",
        "password": "enc-pw",
    }
    with (
        patch("app.services.storage_test.decrypt_value", return_value="pw"),
        patch(
            "asyncio.create_subprocess_exec",
            new=_async_mock_exec(
                _make_rclone_proc(0, stdout="obs"),
                _make_rclone_proc(1, stderr="access denied"),
            ),
        ),
    ):
        ok, msg = await svc.test_cifs(config)
    assert ok is False
    assert "rclone lsd failed" in msg


@pytest.mark.asyncio
async def test_cifs_obscure_failure():
    config = {
        "host": "fileserver",
        "share": "data",
        "username": "user",
        "password": "enc-pw",
    }
    with (
        patch("app.services.storage_test.decrypt_value", return_value="pw"),
        patch("asyncio.create_subprocess_exec", new=_async_mock_exec(_make_rclone_proc(1))),
    ):
        ok, msg = await svc.test_cifs(config)
    assert ok is False
    assert "rclone obscure failed" in msg


@pytest.mark.asyncio
async def test_cifs_decrypt_failure():
    config = {"host": "h", "share": "s", "username": "u", "password": "bad"}
    with patch("app.services.storage_test.decrypt_value", side_effect=Exception("bad")):
        ok, msg = await svc.test_cifs(config)
    assert ok is False
    assert "decrypt" in msg.lower()


# ---------------------------------------------------------------------------
# test_nfs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nfs_success():
    reader = MagicMock()
    writer = MagicMock()
    writer.close = MagicMock()
    writer.wait_closed = AsyncMock()

    async def fake_conn(host, port):
        return reader, writer

    with patch("asyncio.open_connection", side_effect=fake_conn):
        ok, msg = await svc.test_nfs({"host": "nfsserver.lab.local", "export_path": "/data"})
    assert ok is True
    assert msg == "ok"


@pytest.mark.asyncio
async def test_nfs_no_host():
    ok, msg = await svc.test_nfs({"export_path": "/data"})
    assert ok is False
    assert "host" in msg.lower()


@pytest.mark.asyncio
async def test_nfs_timeout():
    with patch("asyncio.open_connection", side_effect=TimeoutError()):
        ok, msg = await svc.test_nfs({"host": "nfsserver", "export_path": "/data"})
    assert ok is False
    assert "timed out" in msg


@pytest.mark.asyncio
async def test_nfs_connection_refused():
    with patch("asyncio.open_connection", side_effect=OSError("Connection refused")):
        ok, msg = await svc.test_nfs({"host": "nfsserver", "export_path": "/data"})
    assert ok is False
    assert "failed" in msg
