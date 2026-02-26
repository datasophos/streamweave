"""Audit logging service — records create/update/delete/restore actions."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, AuditLog
from app.models.user import User


async def log_action(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    action: AuditAction,
    actor: User,
    changes: dict[str, Any] | None = None,
) -> None:
    """Record an admin action in the audit log."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor.id,
        actor_email=actor.email,
        changes=changes,
    )
    db.add(entry)
    # Flush so the entry is persisted with the surrounding transaction
    await db.flush()
