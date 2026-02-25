#!/usr/bin/env python3
"""Seed the database with simulated laboratory instrument configurations."""

import asyncio
import sys

sys.path.insert(0, "../backend")

from app.config import settings  # noqa: E402
from app.database import async_session_factory, engine  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.hook import HookConfig, HookImplementation, HookTrigger  # noqa: E402
from app.models.instrument import Instrument, ServiceAccount, TransferAdapterType  # noqa: E402
from app.models.schedule import HarvestSchedule  # noqa: E402
from app.models.storage import StorageLocation, StorageType  # noqa: E402
from app.services.credentials import encrypt_value  # noqa: E402


async def seed():
    # Create a shared service account for all simlab instruments
    service_account = ServiceAccount(
        name="simlab-service",
        domain="WORKGROUP",
        username="labuser",
        password_encrypted=encrypt_value("labpass"),
    )

    # Storage locations
    archive_storage = StorageLocation(
        name="Archive Storage",
        type=StorageType.posix,
        base_path="/storage/archive",
        connection_config={},
        enabled=True,
    )
    restricted_storage = StorageLocation(
        name="Restricted Storage",
        type=StorageType.posix,
        base_path="/storage/restricted",
        connection_config={},
        enabled=True,
    )

    # Instruments
    microscope = Instrument(
        name="Microscope 01",
        description="Simulated optical microscope",
        location="Lab A, Room 101",
        cifs_host="microscope-01",
        cifs_share="microscope",
        cifs_base_path="/",
        service_account=service_account,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    spectrometer = Instrument(
        name="Spectrometer 01",
        description="Simulated UV-Vis spectrometer",
        location="Lab B, Room 205",
        cifs_host="spectrometer-01",
        cifs_share="spectrometer",
        cifs_base_path="/",
        service_account=service_account,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )
    xrd = Instrument(
        name="X-Ray Diffraction 01",
        description="Simulated X-ray diffractometer",
        location="Lab C, Room 310",
        cifs_host="xray-diffraction-01",
        cifs_share="xrd",
        cifs_base_path="/",
        service_account=service_account,
        transfer_adapter=TransferAdapterType.rclone,
        enabled=True,
    )

    async with async_session_factory() as session:
        session.add_all([
            service_account,
            archive_storage,
            restricted_storage,
            microscope,
            spectrometer,
            xrd,
        ])
        await session.flush()

        # Schedules — every 15 minutes
        schedules = [
            HarvestSchedule(
                instrument_id=microscope.id,
                default_storage_location_id=archive_storage.id,
                cron_expression="*/15 * * * *",
                enabled=True,
            ),
            HarvestSchedule(
                instrument_id=spectrometer.id,
                default_storage_location_id=archive_storage.id,
                cron_expression="*/15 * * * *",
                enabled=True,
            ),
            HarvestSchedule(
                instrument_id=xrd.id,
                default_storage_location_id=restricted_storage.id,
                cron_expression="*/15 * * * *",
                enabled=True,
            ),
        ]
        session.add_all(schedules)
        await session.flush()

        # Hook configs
        hooks = [
            HookConfig(
                name="Microscope File Filter",
                description="Exclude temporary files from microscope harvests",
                trigger=HookTrigger.pre_transfer,
                implementation=HookImplementation.builtin,
                builtin_name="file_filter",
                config={"exclude_patterns": ["*.tmp", "*.lock", "~$*"]},
                instrument_id=microscope.id,
                priority=0,
                enabled=True,
            ),
            HookConfig(
                name="Microscope Metadata Enrichment",
                description="Extract experiment and run info from file paths",
                trigger=HookTrigger.post_transfer,
                implementation=HookImplementation.builtin,
                builtin_name="metadata_enrichment",
                config={
                    "rules": [
                        {
                            "pattern": r"/(?P<username>[a-z][a-z0-9_]*)/(?P<experiment>experiment_\d+)",
                            "source": "path",
                        },
                    ]
                },
                instrument_id=microscope.id,
                priority=0,
                enabled=True,
            ),
        ]
        session.add_all(hooks)
        await session.commit()

    print("Simlab seed data created successfully.")
    print(f"  Service account: {service_account.name} (id={service_account.id})")
    print(f"  Instruments: {microscope.name}, {spectrometer.name}, {xrd.name}")
    print(f"  Storage: {archive_storage.name}, {restricted_storage.name}")
    print(f"  Schedules: {len(schedules)} created")
    print(f"  Hooks: {len(hooks)} created")


if __name__ == "__main__":
    asyncio.run(seed())
