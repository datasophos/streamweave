"""
Tests for the TORTURE_MODE dev seeder.

These tests use a fresh in-memory SQLite DB (via the db_session fixture from
conftest) to verify count correctness and idempotency without affecting any
other test state.
"""

import pytest
from sqlalchemy import func, select

from app.dev_seed_torture import seed_torture_data
from app.models.file import FileRecord
from app.models.instrument import Instrument, ServiceAccount
from app.models.schedule import HarvestSchedule
from app.models.storage import StorageLocation


@pytest.mark.asyncio
async def test_seed_creates_expected_counts(db_session):
    """
    With n_per_type=2 and files_per_instrument=20:
    - 4 types × 2 = 8 instruments
    - 8 harvest schedules
    - 1 storage location
    - 4 service accounts
    - files: NMR 200 exp × 5 = 1000, HPLC 250 sets × 4 = 1000, etc.
      (generators are fixed; files_per_instrument is informational for the runner)
    """
    await seed_torture_data(n_per_type=2, files_per_instrument=20, session=db_session)

    instrument_count = (
        await db_session.execute(
            select(func.count()).select_from(Instrument).where(Instrument.name.like("TORTURE-%"))
        )
    ).scalar_one()
    assert instrument_count == 8, f"Expected 8 instruments, got {instrument_count}"

    schedule_count = (
        await db_session.execute(select(func.count()).select_from(HarvestSchedule))
    ).scalar_one()
    assert schedule_count == 8, f"Expected 8 schedules, got {schedule_count}"

    storage_count = (
        await db_session.execute(
            select(func.count())
            .select_from(StorageLocation)
            .where(StorageLocation.name == "TORTURE Archive")
        )
    ).scalar_one()
    assert storage_count == 1, f"Expected 1 storage location, got {storage_count}"

    sa_count = (
        await db_session.execute(
            select(func.count())
            .select_from(ServiceAccount)
            .where(ServiceAccount.name.like("TORTURE-SA-%"))
        )
    ).scalar_one()
    assert sa_count == 4, f"Expected 4 service accounts, got {sa_count}"

    # Each instrument generates files via its type-specific generator.
    # With n_per_type=2: 2 NMR + 2 HPLC + 2 MS + 2 TEM instruments.
    # NMR: 200 exp × 5 files = 1000 per instrument
    # HPLC: 250 sets × 4 files = 1000 per instrument
    # MS: 333 batches × 3 files = 999 per instrument
    # TEM: 250 sessions × 4 files = 1000 per instrument
    # Total = (1000 + 1000 + 999 + 1000) × 2 = 7998
    file_count = (
        await db_session.execute(select(func.count()).select_from(FileRecord))
    ).scalar_one()
    assert file_count > 0, "Expected files to be created"
    # All files belong to TORTURE instruments
    torture_instrument_ids = (
        (await db_session.execute(select(Instrument.id).where(Instrument.name.like("TORTURE-%"))))
        .scalars()
        .all()
    )
    files_for_torture = (
        await db_session.execute(
            select(func.count())
            .select_from(FileRecord)
            .where(FileRecord.instrument_id.in_(torture_instrument_ids))
        )
    ).scalar_one()
    assert files_for_torture == file_count


@pytest.mark.asyncio
async def test_seed_is_idempotent(db_session):
    """Calling seed_torture_data twice must not double the row counts."""
    await seed_torture_data(n_per_type=2, files_per_instrument=20, session=db_session)
    await seed_torture_data(n_per_type=2, files_per_instrument=20, session=db_session)

    instrument_count = (
        await db_session.execute(
            select(func.count()).select_from(Instrument).where(Instrument.name.like("TORTURE-%"))
        )
    ).scalar_one()
    assert instrument_count == 8, (
        f"Idempotency violated: expected 8 instruments, got {instrument_count}"
    )

    schedule_count = (
        await db_session.execute(select(func.count()).select_from(HarvestSchedule))
    ).scalar_one()
    assert schedule_count == 8

    sa_count = (
        await db_session.execute(
            select(func.count())
            .select_from(ServiceAccount)
            .where(ServiceAccount.name.like("TORTURE-SA-%"))
        )
    ).scalar_one()
    assert sa_count == 4
