import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: uuid.UUID
    recipient_id: uuid.UUID
    type: str
    title: str
    message: str
    link: str | None
    read: bool
    dismissed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountRead(BaseModel):
    count: int
