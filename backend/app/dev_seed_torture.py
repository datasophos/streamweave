"""
TORTURE_MODE dev seeder.

Bulk-inserts a large realistic dataset directly into the DB (bypassing the API)
for stress-testing pagination, UI performance, and query latency.

Activated by setting TORTURE_MODE=true in .env or docker-compose.dev.yml.
The lifespan hook in main.py calls seed_torture_data() on startup.
"""

from __future__ import annotations

import base64
import random
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import FileRecord, PersistentIdType
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType
from app.models.schedule import HarvestSchedule
from app.models.storage import StorageLocation, StorageType

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CRON_POOL = [
    "0 1 * * *",
    "0 2 * * *",
    "0 3 * * *",
    "0 4 * * *",
    "30 0 * * *",
    "0 0 * * 0",
]

_INSTRUMENT_TYPES = ["NMR", "HPLC", "MS", "TEM"]

_FILE_BATCH_SIZE = 5_000

# Realistic size ranges (bytes) per instrument type / file role
_NMR_SIZES: dict[str, tuple[int, int]] = {
    "fid": (1_800_000, 2_200_000),
    "acqus": (4_000, 8_000),
    "acqu2s": (3_000, 6_000),
    "pdata/1/1r": (900_000, 1_100_000),
    "pdata/1/1i": (900_000, 1_100_000),
}

_HPLC_SIZES: dict[str, tuple[int, int]] = {
    "arw": (50_000, 200_000),
    "met": (5_000, 20_000),
    "seq": (2_000, 10_000),
    "pdf": (100_000, 500_000),
}

_MS_SIZES: dict[str, tuple[int, int]] = {
    "raw": (500_000, 5_000_000),
    "meth": (10_000, 50_000),
    "txt": (5_000, 20_000),
}

_TEM_SIZES: dict[str, tuple[int, int]] = {
    "dm4": (80_000_000, 120_000_000),
    "msa": (10_000, 50_000),
    "xml": (5_000, 20_000),
    "log": (1_000, 10_000),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _uuid_to_base32(u: uuid.UUID) -> str:
    return base64.b32encode(u.bytes).decode().rstrip("=").lower()


def _mint_ark() -> str:
    return f"ark:/99999/fk4{_uuid_to_base32(uuid.uuid4())}"


def _rand_mtime() -> datetime:
    """Random datetime within the last 3 years."""
    days_ago = random.randint(0, 365 * 3)
    seconds_ago = random.randint(0, 86_400)
    return datetime.now(UTC) - timedelta(days=days_ago, seconds=seconds_ago)


def _jitter_size(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def _rand_hex(n: int = 16) -> str:
    return f"{random.getrandbits(n * 4):0{n}x}"


# ---------------------------------------------------------------------------
# Per-type file path generators
# Each returns a list of (source_path, filename, size_bytes) tuples.
# ---------------------------------------------------------------------------


def _nmr_files(instrument_idx: int) -> list[tuple[str, str, int]]:
    """200 experiments × 5 files = 1000 files per instrument."""
    files: list[tuple[str, str, int]] = []
    base = datetime.now(UTC) - timedelta(days=365)
    for exp in range(200):
        dt = base + timedelta(days=exp // 4)
        year = dt.strftime("%Y")
        mm = dt.strftime("%m")
        dd = dt.strftime("%d")
        expno = exp + 1
        prefix = f"/{year}/{mm}/{dd}/{expno:04d}"
        for fname, (lo, hi) in _NMR_SIZES.items():
            path = f"{prefix}/{fname}"
            files.append((path, fname.split("/")[-1], _jitter_size(lo, hi)))
    return files


def _hplc_files(instrument_idx: int) -> list[tuple[str, str, int]]:
    """250 sample sets × 4 files = 1000 files per instrument."""
    files: list[tuple[str, str, int]] = []
    base = datetime.now(UTC) - timedelta(days=365)
    for s in range(250):
        dt = base + timedelta(days=s // 5)
        year = dt.strftime("%Y")
        mm = dt.strftime("%m")
        set_name = f"set_{s + 1:04d}"
        prefix = f"/{year}/{mm}/{set_name}"
        n = s + 1
        file_defs = [
            (f"sample_{n}.arw", "arw"),
            ("method.met", "met"),
            ("sequence.seq", "seq"),
            (f"report_{n}.pdf", "pdf"),
        ]
        for fname, ext in file_defs:
            lo, hi = _HPLC_SIZES[ext]
            path = f"{prefix}/{fname}"
            files.append((path, fname, _jitter_size(lo, hi)))
    return files


def _ms_files(instrument_idx: int) -> list[tuple[str, str, int]]:
    """333 batches × 3 files = 999 files per instrument (≈1000)."""
    files: list[tuple[str, str, int]] = []
    base = datetime.now(UTC) - timedelta(days=365)
    for b in range(333):
        dt = base + timedelta(days=b // 7)
        year = dt.strftime("%Y")
        batch = b + 1
        n = batch
        prefix = f"/{year}/batch_{batch:04d}"
        file_defs = [
            (f"sample_{n}.raw", "raw"),
            (f"sample_{n}.meth", "meth"),
            ("instrument_log.txt", "txt"),
        ]
        for fname, ext in file_defs:
            lo, hi = _MS_SIZES[ext]
            path = f"{prefix}/{fname}"
            files.append((path, fname, _jitter_size(lo, hi)))
    return files


def _tem_files(instrument_idx: int) -> list[tuple[str, str, int]]:
    """250 sessions × 4 files = 1000 files per instrument."""
    files: list[tuple[str, str, int]] = []
    base = datetime.now(UTC) - timedelta(days=365)
    for s in range(250):
        dt = base + timedelta(days=s // 3)
        year = dt.strftime("%Y")
        session_date = dt.strftime("%Y%m%d")
        n = s + 1
        prefix = f"/{year}/{n:04d}_{session_date}"
        file_defs = [
            (f"{n:04d}.dm4", "dm4"),
            (f"{n:04d}_eds.msa", "msa"),
            (f"{n:04d}_metadata.xml", "xml"),
            ("session_log.txt", "log"),
        ]
        for fname, ext in file_defs:
            lo, hi = _TEM_SIZES[ext]
            path = f"{prefix}/{fname}"
            files.append((path, fname, _jitter_size(lo, hi)))
    return files


_FILE_GENERATORS = {
    "NMR": _nmr_files,
    "HPLC": _hplc_files,
    "MS": _ms_files,
    "TEM": _tem_files,
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def seed_torture_data(
    n_per_type: int = 50,
    files_per_instrument: int = 1_000,
    session: AsyncSession | None = None,
) -> None:
    """
    Bulk-insert a large realistic dataset for stress-testing.

    Parameters
    ----------
    n_per_type:
        Number of instruments per type (NMR, HPLC, MS, TEM).
        Default 50 → 200 total instruments.
    files_per_instrument:
        Target file count per instrument. The per-type generators produce a
        fixed number of files; this parameter is used for reporting only when
        calling from the lifespan hook.
    session:
        Optional AsyncSession to use (used by tests to inject the test DB session).
        If None, uses async_session_factory from app.database.
    """
    if session is None:
        from app.database import async_session_factory

        async with async_session_factory() as _session:
            await _seed(
                n_per_type=n_per_type, files_per_instrument=files_per_instrument, session=_session
            )
    else:
        await _seed(
            n_per_type=n_per_type, files_per_instrument=files_per_instrument, session=session
        )


async def _seed(
    n_per_type: int,
    files_per_instrument: int,
    session: AsyncSession,
) -> None:
    # ------------------------------------------------------------------
    # Idempotency guard
    # ------------------------------------------------------------------
    result = await session.execute(
        select(Instrument.id).where(Instrument.name.like("TORTURE-%")).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        print("TORTURE_MODE: TORTURE-* instruments already exist — skipping seed.")
        return

    n_instruments = len(_INSTRUMENT_TYPES) * n_per_type
    print(
        f"TORTURE_MODE: seeding {n_instruments} instruments with {files_per_instrument} files each…"
    )

    now = datetime.now(UTC)

    # ------------------------------------------------------------------
    # StorageLocation
    # ------------------------------------------------------------------
    storage_id = uuid.uuid4()
    await session.execute(
        insert(StorageLocation).values(
            id=storage_id,
            name="TORTURE Archive",
            type=StorageType.posix,
            base_path="/dev/null/torture",
            enabled=True,
            created_at=now,
            updated_at=now,
        )
    )

    # ------------------------------------------------------------------
    # ServiceAccounts — one per instrument type
    # ------------------------------------------------------------------
    sa_ids: dict[str, uuid.UUID] = {}
    sa_rows = []
    for itype in _INSTRUMENT_TYPES:
        sa_id = uuid.uuid4()
        sa_ids[itype] = sa_id
        sa_rows.append(
            {
                "id": sa_id,
                "name": f"TORTURE-SA-{itype}",
                "username": f"torture_{itype.lower()}",
                "password_encrypted": "dG9ydHVyZQ==",  # placeholder — not used in tests
                "created_at": now,
                "updated_at": now,
            }
        )
    await session.execute(insert(ServiceAccount).values(sa_rows))

    # ------------------------------------------------------------------
    # Instruments + HarvestSchedules
    # ------------------------------------------------------------------
    instrument_rows = []
    schedule_rows = []

    for itype in _INSTRUMENT_TYPES:
        for i in range(1, n_per_type + 1):
            inst_id = uuid.uuid4()
            name = f"TORTURE-{itype}-{i:03d}"
            cron = _CRON_POOL[(i - 1) % len(_CRON_POOL)]

            instrument_rows.append(
                {
                    "id": inst_id,
                    "name": name,
                    "cifs_host": f"10.99.{(_INSTRUMENT_TYPES.index(itype))}.{i % 256}",
                    "cifs_share": "data",
                    "service_account_id": sa_ids[itype],
                    "transfer_adapter": TransferAdapterType.rclone,
                    "enabled": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            schedule_rows.append(
                {
                    "id": uuid.uuid4(),
                    "instrument_id": inst_id,
                    "default_storage_location_id": storage_id,
                    "cron_expression": cron,
                    "enabled": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )

    await session.execute(insert(Instrument).values(instrument_rows))
    await session.execute(insert(HarvestSchedule).values(schedule_rows))
    await session.flush()

    # ------------------------------------------------------------------
    # FileRecords — generated per instrument type, batched for memory
    # ------------------------------------------------------------------
    # Build a list of (instrument_id, instrument_type, instrument_index) tuples
    inst_meta: list[tuple[uuid.UUID, str, int]] = []
    for row in instrument_rows:
        itype = row["name"].split("-")[1]  # e.g. "NMR"
        idx = int(row["name"].split("-")[2]) - 1  # 0-based
        inst_meta.append((row["id"], itype, idx))

    file_buffer: list[dict] = []

    async def _flush_buffer() -> None:
        if file_buffer:
            await session.execute(insert(FileRecord).values(file_buffer))
            file_buffer.clear()

    # SQLite limits SQL variables to 999; with 10 columns per FileRecord row
    # the safe batch size is floor(999/10) = 99. PostgreSQL has no such limit.
    conn = await session.connection()
    effective_batch_size = 90 if conn.dialect.name == "sqlite" else _FILE_BATCH_SIZE

    for inst_id, itype, idx in inst_meta:
        gen = _FILE_GENERATORS[itype]
        raw_files = gen(idx)

        for source_path, filename, size_bytes in raw_files:
            mtime = _rand_mtime()
            discovered = mtime + timedelta(seconds=random.randint(0, 7 * 86_400))

            file_buffer.append(
                {
                    "id": uuid.uuid4(),
                    "persistent_id": _mint_ark(),
                    "persistent_id_type": PersistentIdType.ark,
                    "instrument_id": inst_id,
                    "source_path": source_path,
                    "filename": filename,
                    "size_bytes": size_bytes,
                    "source_mtime": mtime,
                    "first_discovered_at": discovered,
                    "xxhash": _rand_hex(16),
                }
            )

            if len(file_buffer) >= effective_batch_size:
                await _flush_buffer()

        print(f"  {inst_id} ({itype}) — {len(raw_files)} files queued")

    await _flush_buffer()
    await session.commit()

    total_instruments = len(instrument_rows)
    print(f"TORTURE_MODE: done — {total_instruments} instruments seeded.")
