"""Real connectivity tests for each storage location type."""

from __future__ import annotations

import asyncio
import os

from app.services.credentials import decrypt_value


async def test_posix(base_path: str) -> tuple[bool, str]:
    """Check that base_path exists and is readable/writable."""
    if not os.path.isdir(base_path):
        return False, f"Path does not exist or is not a directory: {base_path}"
    if not os.access(base_path, os.R_OK | os.W_OK):
        return False, f"Path is not readable/writable: {base_path}"
    return True, "ok"


async def _rclone_run(args: list[str], env: dict[str, str] | None = None) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()
    assert proc.returncode is not None
    return proc.returncode, stdout.decode(), stderr.decode()


async def test_s3(config: dict, base_path: str) -> tuple[bool, str]:
    """Use rclone lsd to verify S3 bucket access."""
    bucket = config.get("bucket", "")
    region = config.get("region", "")
    endpoint_url = config.get("endpoint_url") or ""
    access_key_id = config.get("access_key_id", "")
    secret_key_enc = config.get("secret_access_key", "")

    try:
        secret_key = decrypt_value(secret_key_enc)
    except Exception as exc:
        return False, f"Could not decrypt secret_access_key: {exc}"

    args = [
        "rclone",
        "lsd",
        f":s3:{bucket}",
        "--s3-access-key-id",
        access_key_id,
        "--s3-secret-access-key",
        secret_key,
        "--max-depth",
        "1",
    ]
    if region:
        args += ["--s3-region", region]
    if endpoint_url:
        args += ["--s3-endpoint", endpoint_url]

    rc, _, stderr = await _rclone_run(args)
    if rc != 0:
        return False, f"rclone lsd failed: {stderr.strip()[:300]}"
    return True, "ok"


async def test_cifs(config: dict) -> tuple[bool, str]:
    """Use rclone lsd to verify CIFS/SMB share access."""
    host = config.get("host", "")
    share = config.get("share", "")
    domain = config.get("domain") or "WORKGROUP"
    username = config.get("username", "")
    password_enc = config.get("password", "")

    try:
        password = decrypt_value(password_enc)
    except Exception as exc:
        return False, f"Could not decrypt password: {exc}"

    # Get rclone-obscured password
    rc, stdout, _ = await _rclone_run(["rclone", "obscure", password])
    if rc != 0:
        return False, "rclone obscure failed — is rclone installed?"
    obscured = stdout.strip()

    args = [
        "rclone",
        "lsd",
        f":smb:{share}",
        "--smb-host",
        host,
        "--smb-user",
        username,
        "--smb-domain",
        domain,
        "--smb-pass",
        obscured,
        "--max-depth",
        "1",
    ]
    rc, _, stderr = await _rclone_run(args)
    if rc != 0:
        return False, f"rclone lsd failed: {stderr.strip()[:300]}"
    return True, "ok"


async def test_nfs(config: dict) -> tuple[bool, str]:
    """TCP port probe to verify NFS server is reachable on port 2049."""
    host = config.get("host", "")
    if not host:
        return False, "NFS host is not configured"
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, 2049),
            timeout=5.0,
        )
        writer.close()
        await writer.wait_closed()
        return True, "ok"
    except TimeoutError:
        return False, f"Connection to {host}:2049 timed out"
    except OSError as exc:
        return False, f"Connection to {host}:2049 failed: {exc}"
