"""Base classes for transfer adapters."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DiscoveredFile:
    """A file discovered on a remote instrument."""

    path: str
    filename: str
    size_bytes: int
    mod_time: datetime | None = None
    is_dir: bool = False


@dataclass
class TransferResult:
    """Result of a single file transfer."""

    success: bool
    source_path: str
    destination_path: str
    bytes_transferred: int = 0
    source_checksum: str = ""
    dest_checksum: str = ""
    checksum_verified: bool = False
    error_message: str = ""
    extra: dict = field(default_factory=dict)


class TransferAdapter(abc.ABC):
    """Abstract base class for file transfer adapters."""

    @abc.abstractmethod
    async def discover(self) -> list[DiscoveredFile]:
        """Discover files available on the remote source."""

    @abc.abstractmethod
    async def transfer_file(
        self, source_path: str, destination_path: str
    ) -> TransferResult:
        """Transfer a single file from source to destination."""

    @abc.abstractmethod
    async def checksum(self, local_path: str) -> str:
        """Compute checksum of a local file."""
