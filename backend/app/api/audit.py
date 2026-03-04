"""Admin endpoint for querying the audit log."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.api.pagination import PaginatedResponse, PaginationParams, paginate
from app.models.audit import AuditAction, AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogRead

router = APIRouter(prefix="/admin/audit-logs", tags=["audit"])


@router.get("", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    entity_type: str | None = Query(None),
    action: AuditAction | None = Query(None),
    actor_id: uuid.UUID | None = Query(None),
    since: date | None = Query(None),
    until: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
    if until:
        stmt = stmt.where(AuditLog.created_at <= until)
    return await paginate(db, stmt, PaginationParams(skip=skip, limit=limit))
