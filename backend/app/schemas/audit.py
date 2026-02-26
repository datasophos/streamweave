import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.audit import AuditAction


class AuditLogRead(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: AuditAction
    actor_id: uuid.UUID | None
    actor_email: str
    changes: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}
