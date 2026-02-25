import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.file import PersistentIdType


class FileRecordRead(BaseModel):
    id: uuid.UUID
    persistent_id: str
    persistent_id_type: PersistentIdType
    instrument_id: uuid.UUID
    source_path: str
    filename: str
    size_bytes: int | None
    source_mtime: datetime | None
    xxhash: str | None
    sha256: str | None
    first_discovered_at: datetime
    metadata_: dict | None
    owner_id: uuid.UUID | None

    model_config = {"from_attributes": True}
