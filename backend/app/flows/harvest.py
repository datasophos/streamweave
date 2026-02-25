"""Prefect flow and tasks for harvesting files from instruments."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from prefect import flow, get_run_logger, task
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.hooks.base import HookAction, HookContext
from app.hooks.runner import run_hooks
from app.models.access import FileAccessGrant, GranteeType
from app.models.file import FileRecord
from app.models.hook import HookTrigger
from app.models.instrument import Instrument
from app.models.schedule import HarvestSchedule
from app.models.transfer import FileTransfer, TransferStatus
from app.services.db import get_db_session
from app.services.discovery import discover_new_files
from app.services.identifiers import mint_identifier
from app.transfers.factory import create_adapter

_fallback_logger = logging.getLogger(__name__)


def _get_logger():
    """Get Prefect run logger if in a flow/task context, else stdlib fallback."""
    try:
        return get_run_logger()
    except Exception:
        return _fallback_logger


async def _resolve_grantee(session, grantee_type: str, name: str) -> uuid.UUID | None:
    """Resolve a grantee name to a UUID."""
    if grantee_type == "user":
        from app.models.user import User

        result = await session.execute(select(User.id).where(User.email == name))
    elif grantee_type == "group":
        from app.models.group import Group

        result = await session.execute(select(Group.id).where(Group.name == name))
    elif grantee_type == "project":
        from app.models.project import Project

        result = await session.execute(select(Project.id).where(Project.name == name))
    else:
        return None
    return result.scalar_one_or_none()


@task(retries=2, retry_delay_seconds=30)
async def discover_files_task(instrument_id: str, schedule_id: str) -> dict:
    """Discover new files on the instrument and return them as serializable dicts."""
    logger = _get_logger()
    inst_uuid = uuid.UUID(instrument_id)
    sched_uuid = uuid.UUID(schedule_id)

    async with get_db_session() as session:
        result = await session.execute(
            select(Instrument)
            .options(selectinload(Instrument.service_account))
            .where(Instrument.id == inst_uuid)
        )
        instrument = result.scalar_one_or_none()
        if not instrument:
            raise ValueError(f"Instrument {instrument_id} not found")

        logger.info(
            "Discovering files on %s (%s:%s)",
            instrument.name,
            instrument.cifs_host,
            instrument.cifs_share,
        )

        adapter = create_adapter(instrument)
        all_files = await adapter.discover()
        logger.info("Found %d total files on %s", len(all_files), instrument.name)

        new_files = await discover_new_files(inst_uuid, all_files, session)
        logger.info("%d new files to harvest (out of %d total)", len(new_files), len(all_files))

        if new_files:
            for f in new_files:
                logger.info("  NEW: %s (%d bytes)", f.path, f.size_bytes)
        else:
            logger.info("No new files — all %d files already known", len(all_files))

        # Get schedule for storage location
        schedule = await session.get(HarvestSchedule, sched_uuid)
        storage_location_id = str(schedule.default_storage_location_id) if schedule else ""

    return {
        "instrument_id": instrument_id,
        "instrument_name": instrument.name,
        "schedule_id": schedule_id,
        "storage_location_id": storage_location_id,
        "new_files": [
            {
                "path": f.path,
                "filename": f.filename,
                "size_bytes": f.size_bytes,
                "mod_time": f.mod_time.isoformat() if f.mod_time else None,
            }
            for f in new_files
        ],
        "total_discovered": len(all_files),
    }


@task(retries=1, retry_delay_seconds=10)
async def transfer_single_file_task(
    file_info: dict,
    instrument_id: str,
    instrument_name: str,
    schedule_id: str,
    storage_location_id: str,
) -> dict:
    """Transfer a single file: create record, run hooks, transfer, verify."""
    logger = _get_logger()
    inst_uuid = uuid.UUID(instrument_id)
    storage_uuid = uuid.UUID(storage_location_id)
    source_path = file_info["path"]
    filename = file_info["filename"]

    logger.info("Processing %s from %s", source_path, instrument_name)

    async with get_db_session() as session:
        # Load instrument with hooks and service account
        result = await session.execute(
            select(Instrument)
            .options(
                selectinload(Instrument.service_account),
                selectinload(Instrument.hooks),
            )
            .where(Instrument.id == inst_uuid)
        )
        instrument = result.scalar_one()
        hook_configs = instrument.hooks

        # Load storage location for destination path
        from app.models.storage import StorageLocation

        storage = await session.get(StorageLocation, storage_uuid)
        if not storage:
            raise ValueError(f"Storage location {storage_location_id} not found")

        # Mint persistent identifier
        pid, pid_type = mint_identifier()
        logger.info("Minted identifier %s for %s", pid, filename)

        # Create FileRecord
        mod_time = None
        if file_info.get("mod_time"):
            mod_time = datetime.fromisoformat(file_info["mod_time"])

        file_record = FileRecord(
            persistent_id=pid,
            persistent_id_type=pid_type,
            instrument_id=inst_uuid,
            source_path=source_path,
            filename=filename,
            size_bytes=file_info.get("size_bytes", 0),
            source_mtime=mod_time,
            first_discovered_at=datetime.now(UTC),
            metadata_={},
        )
        session.add(file_record)
        await session.flush()

        # Build hook context
        destination_path = f"{storage.base_path}/{instrument.name}/{source_path}"
        hook_ctx = HookContext(
            source_path=source_path,
            filename=filename,
            instrument_id=instrument_id,
            instrument_name=instrument_name,
            size_bytes=file_info.get("size_bytes", 0),
            destination_path=destination_path,
        )

        # Run pre-transfer hooks
        pre_result = await run_hooks(HookTrigger.pre_transfer, hook_ctx, hook_configs)

        if pre_result.action == HookAction.skip:
            logger.info("SKIPPED %s — %s", filename, pre_result.message)
            transfer = FileTransfer(
                file_id=file_record.id,
                storage_location_id=storage_uuid,
                transfer_adapter=instrument.transfer_adapter,
                status=TransferStatus.skipped,
                error_message=pre_result.message,
            )
            session.add(transfer)
            return {
                "file_id": str(file_record.id),
                "status": "skipped",
                "message": pre_result.message,
            }

        if pre_result.action == HookAction.redirect:
            destination_path = f"{pre_result.redirect_path}/{instrument.name}/{source_path}"
            logger.info("REDIRECTED %s → %s", filename, destination_path)

        # Create transfer record
        logger.info("Transferring %s → %s", source_path, destination_path)
        transfer = FileTransfer(
            file_id=file_record.id,
            storage_location_id=storage_uuid,
            destination_path=destination_path,
            transfer_adapter=instrument.transfer_adapter,
            status=TransferStatus.in_progress,
            started_at=datetime.now(UTC),
        )
        session.add(transfer)
        await session.flush()

        # Execute transfer
        adapter = create_adapter(instrument)
        try:
            transfer_result = await adapter.transfer_file(source_path, destination_path)
        except Exception as e:
            logger.error("FAILED %s — %s", filename, e)
            transfer.status = TransferStatus.failed
            transfer.error_message = str(e)
            transfer.completed_at = datetime.now(UTC)
            return {
                "file_id": str(file_record.id),
                "status": "failed",
                "error": str(e),
            }

        if not transfer_result.success:
            logger.error("FAILED %s — %s", filename, transfer_result.error_message)
            transfer.status = TransferStatus.failed
            transfer.error_message = transfer_result.error_message
            transfer.completed_at = datetime.now(UTC)
            return {
                "file_id": str(file_record.id),
                "status": "failed",
                "error": transfer_result.error_message,
            }

        # Update transfer record
        transfer.status = TransferStatus.completed
        transfer.bytes_transferred = transfer_result.bytes_transferred
        transfer.dest_checksum = transfer_result.dest_checksum
        transfer.checksum_verified = transfer_result.checksum_verified
        transfer.completed_at = datetime.now(UTC)

        # Update file record checksum
        if transfer_result.dest_checksum:
            file_record.xxhash = transfer_result.dest_checksum

        logger.info(
            "COMPLETED %s — %d bytes, checksum %s",
            filename,
            transfer_result.bytes_transferred,
            transfer_result.dest_checksum or "n/a",
        )

        # Run post-transfer hooks
        hook_ctx.transfer_success = True
        hook_ctx.checksum = transfer_result.dest_checksum
        post_result = await run_hooks(HookTrigger.post_transfer, hook_ctx, hook_configs)

        if post_result.metadata_updates:
            merged = file_record.metadata_ or {}
            merged.update(post_result.metadata_updates)
            file_record.metadata_ = merged
            logger.info("Enriched metadata for %s: %s", filename, post_result.metadata_updates)

        # Create access grants from hook results
        if post_result.access_grants:
            for grant_info in post_result.access_grants:
                if "grantee_id" in grant_info:
                    try:
                        grant = FileAccessGrant(
                            file_id=file_record.id,
                            grantee_type=GranteeType(grant_info["grantee_type"]),
                            grantee_id=uuid.UUID(grant_info["grantee_id"]),
                        )
                        session.add(grant)
                    except (ValueError, KeyError) as e:
                        logger.warning("Skipping invalid access grant: %s", e)
                elif "resolve_value" in grant_info:
                    # Resolve by name — look up user/group/project by name
                    resolved_id = await _resolve_grantee(
                        session,
                        grant_info["grantee_type"],
                        grant_info["resolve_value"],
                    )
                    if resolved_id:
                        grant = FileAccessGrant(
                            file_id=file_record.id,
                            grantee_type=GranteeType(grant_info["grantee_type"]),
                            grantee_id=resolved_id,
                        )
                        session.add(grant)
                    else:
                        logger.warning(
                            "Could not resolve %s '%s' for access grant",
                            grant_info["grantee_type"],
                            grant_info["resolve_value"],
                        )
            logger.info("Created %d access grants for %s", len(post_result.access_grants), filename)

        return {
            "file_id": str(file_record.id),
            "persistent_id": pid,
            "status": "completed",
            "bytes": transfer_result.bytes_transferred,
            "checksum": transfer_result.dest_checksum,
        }


@flow(name="harvest-instrument")
async def harvest_instrument_flow(instrument_id: str, schedule_id: str) -> dict:
    """Orchestrate harvest: discover files, then transfer each one."""
    logger = _get_logger()

    discovery = await discover_files_task(instrument_id, schedule_id)
    instrument_name = discovery["instrument_name"]

    # Rename the flow run so it's human-readable in the Prefect UI
    try:
        import prefect.context
        from prefect.client.orchestration import get_client

        ctx = prefect.context.get_run_context()
        if ctx and ctx.flow_run:
            async with get_client() as client:
                await client.update_flow_run(
                    ctx.flow_run.id,
                    name=f"harvest-{instrument_name}",
                )
    except Exception:
        pass  # Non-critical — just cosmetic

    new_files = discovery["new_files"]
    if not new_files:
        logger.info("No new files for %s — nothing to do", instrument_name)
        return {
            "instrument_id": instrument_id,
            "total_discovered": discovery["total_discovered"],
            "new_files": 0,
            "transferred": 0,
            "skipped": 0,
            "failed": 0,
        }

    logger.info("Harvesting %d new files from %s", len(new_files), instrument_name)

    results = []
    for file_info in new_files:
        result = await transfer_single_file_task(
            file_info=file_info,
            instrument_id=instrument_id,
            instrument_name=discovery["instrument_name"],
            schedule_id=schedule_id,
            storage_location_id=discovery["storage_location_id"],
        )
        results.append(result)

    completed = sum(1 for r in results if r["status"] == "completed")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    failed = sum(1 for r in results if r["status"] == "failed")
    logger.info(
        "Harvest complete for %s: %d transferred, %d skipped, %d failed",
        instrument_name,
        completed,
        skipped,
        failed,
    )

    return {
        "instrument_id": instrument_id,
        "total_discovered": discovery["total_discovered"],
        "new_files": len(new_files),
        "transferred": completed,
        "skipped": skipped,
        "failed": failed,
    }
