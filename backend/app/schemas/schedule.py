import uuid
from datetime import datetime

from pydantic import BaseModel


class HarvestScheduleCreate(BaseModel):
    instrument_id: uuid.UUID
    default_storage_location_id: uuid.UUID
    cron_expression: str
    enabled: bool = True


class HarvestScheduleRead(BaseModel):
    id: uuid.UUID
    instrument_id: uuid.UUID
    default_storage_location_id: uuid.UUID
    cron_expression: str
    prefect_deployment_id: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HarvestScheduleUpdate(BaseModel):
    instrument_id: uuid.UUID | None = None
    default_storage_location_id: uuid.UUID | None = None
    cron_expression: str | None = None
    enabled: bool | None = None
