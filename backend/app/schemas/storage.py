import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.storage import StorageType


class StorageLocationCreate(BaseModel):
    name: str
    type: StorageType
    connection_config: dict | None = None
    base_path: str
    enabled: bool = True


class StorageLocationRead(BaseModel):
    id: uuid.UUID
    name: str
    type: StorageType
    connection_config: dict | None
    base_path: str
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StorageLocationUpdate(BaseModel):
    name: str | None = None
    type: StorageType | None = None
    connection_config: dict | None = None
    base_path: str | None = None
    enabled: bool | None = None
