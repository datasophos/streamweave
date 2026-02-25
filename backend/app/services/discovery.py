"""Discovery service — filters already-known files from newly discovered ones."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import FileRecord
from app.transfers.base import DiscoveredFile


async def discover_new_files(
    instrument_id: uuid.UUID,
    discovered: list[DiscoveredFile],
    session: AsyncSession,
) -> list[DiscoveredFile]:
    """Return only files not already recorded for this instrument."""
    if not discovered:
        return []

    result = await session.execute(
        select(FileRecord.source_path).where(FileRecord.instrument_id == instrument_id)
    )
    known_paths = set(result.scalars().all())

    return [f for f in discovered if f.path not in known_paths]
