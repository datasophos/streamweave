import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.instrument_request import InstrumentRequestStatus


class InstrumentRequestCreate(BaseModel):
    name: str
    location: str
    harvest_frequency: str
    description: str | None = None
    justification: str


class InstrumentRequestUpdate(BaseModel):
    status: InstrumentRequestStatus
    admin_notes: str | None = None


class InstrumentRequestRead(BaseModel):
    id: uuid.UUID
    requester_id: uuid.UUID
    requester_email: str | None
    name: str
    location: str
    harvest_frequency: str
    description: str | None
    justification: str
    status: InstrumentRequestStatus
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
