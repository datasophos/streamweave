"""Rclone-based transfer adapter for SMB/CIFS instruments."""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import pathlib
from datetime import datetime

import xxhash

from app.transfers.base import DiscoveredFile, TransferAdapter, TransferResult


class RcloneAdapter(TransferAdapter):
    """Transfer adapter using rclone for SMB/CIFS file operations.

    Uses CLI flags (no config files) so concurrent harvests don't conflict.
    Password passed via RCLONE_SMB_PASS env var (rclone accepts plaintext).
    """

    def __init__(
        self,
        *,
        rclone_binary: str = "rclone",
        smb_host: str,
        smb_share: str,
        smb_base_path: str = "/",
        smb_user: str,
        smb_password: str,
        smb_domain: str = "WORKGROUP",
    ):
        self.rclone_binary = rclone_binary
        self.smb_host = smb_host
        self.smb_share = smb_share
        self.smb_base_path = smb_base_path.rstrip("/") or "/"
        self.smb_user = smb_user
        self.smb_password = smb_password
        self.smb_domain = smb_domain
        self._obscured_password: str | None = None

    async def _get_obscured_password(self) -> str:
        """Obscure the plaintext password using rclone obscure.

        rclone env vars expect passwords in rclone's obscured format.
        """
        if self._obscured_password is None:
            proc = await asyncio.create_subprocess_exec(
                self.rclone_binary,
                "obscure",
                self.smb_password,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            self._obscured_password = stdout.decode().strip()
        return self._obscured_password

    def _remote_path(self, path: str = "") -> str:
        """Build the rclone remote path string: :smb:path."""
        base = self.smb_base_path
        if path:
            base = f"{base}/{path}" if base != "/" else f"/{path}"
        return f":smb:{base}"

    def _base_flags(self) -> list[str]:
        return [
            "--smb-host",
            self.smb_host,
            "--smb-user",
            self.smb_user,
            "--smb-domain",
            self.smb_domain,
        ]

    async def _env(self) -> dict[str, str]:
        env = os.environ.copy()
        env["RCLONE_SMB_PASS"] = await self._get_obscured_password()
        return env

    async def _run(self, args: list[str], env: dict[str, str]) -> tuple[int, str, str]:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate()
        assert proc.returncode is not None
        return proc.returncode, stdout.decode(), stderr.decode()

    async def discover(self) -> list[DiscoveredFile]:
        """List files recursively using rclone lsjson."""
        args = [
            self.rclone_binary,
            "lsjson",
            "--recursive",
            *self._base_flags(),
            self._remote_path(),
        ]
        returncode, stdout, stderr = await self._run(args, await self._env())
        if returncode != 0:
            raise RuntimeError(f"rclone lsjson failed (rc={returncode}): {stderr}")

        entries = json.loads(stdout)
        files = []
        for entry in entries:
            if entry.get("IsDir", False):
                continue
            mod_time = None
            if mt := entry.get("ModTime"):
                with contextlib.suppress(ValueError):
                    mod_time = datetime.fromisoformat(mt.replace("Z", "+00:00"))
            files.append(
                DiscoveredFile(
                    path=entry["Path"],
                    filename=entry["Name"],
                    size_bytes=entry.get("Size", 0),
                    mod_time=mod_time,
                )
            )
        return files

    async def transfer_file(self, source_path: str, destination_path: str) -> TransferResult:
        """Transfer a single file using rclone copyto."""
        # Ensure destination directory exists
        dest_dir = pathlib.Path(destination_path).parent
        dest_dir.mkdir(parents=True, exist_ok=True)

        args = [
            self.rclone_binary,
            "copyto",
            *self._base_flags(),
            self._remote_path(source_path),
            destination_path,
        ]
        returncode, stdout, stderr = await self._run(args, await self._env())
        if returncode != 0:
            return TransferResult(
                success=False,
                source_path=source_path,
                destination_path=destination_path,
                error_message=f"rclone copyto failed (rc={returncode}): {stderr}",
            )

        # Compute checksum on destination
        dest_path = pathlib.Path(destination_path)
        if not dest_path.exists():
            return TransferResult(
                success=False,
                source_path=source_path,
                destination_path=destination_path,
                error_message="Destination file not found after transfer",
            )

        dest_checksum = await self.checksum(destination_path)
        size = dest_path.stat().st_size

        return TransferResult(
            success=True,
            source_path=source_path,
            destination_path=destination_path,
            bytes_transferred=size,
            dest_checksum=dest_checksum,
            checksum_verified=False,  # No source checksum to compare against
        )

    async def checksum(self, local_path: str) -> str:
        """Compute xxhash64 of a local file."""
        h = xxhash.xxh64()
        with open(local_path, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()
