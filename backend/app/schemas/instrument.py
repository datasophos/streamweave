import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.instrument import TransferAdapterType


class ServiceAccountCreate(BaseModel):
    name: str
    domain: str | None = None
    username: str
    password: str  # plaintext — encrypted before storage


class ServiceAccountRead(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    username: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceAccountUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    username: str | None = None
    password: str | None = None


class InstrumentCreate(BaseModel):
    name: str
    description: str | None = None
    location: str | None = None
    pid: str | None = None
    cifs_host: str
    cifs_share: str
    cifs_base_path: str | None = None
    service_account_id: uuid.UUID | None = None
    transfer_adapter: TransferAdapterType = TransferAdapterType.rclone
    transfer_config: dict | None = None
    enabled: bool = True


class InstrumentRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    location: str | None
    pid: str | None
    cifs_host: str
    cifs_share: str
    cifs_base_path: str | None
    service_account_id: uuid.UUID | None
    transfer_adapter: TransferAdapterType
    transfer_config: dict | None
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InstrumentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None
    pid: str | None = None
    cifs_host: str | None = None
    cifs_share: str | None = None
    cifs_base_path: str | None = None
    service_account_id: uuid.UUID | None = None
    transfer_adapter: TransferAdapterType | None = None
    transfer_config: dict | None = None
    enabled: bool | None = None
