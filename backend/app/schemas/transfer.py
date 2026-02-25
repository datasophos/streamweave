import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.instrument import TransferAdapterType
from app.models.transfer import TransferStatus


class FileTransferRead(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    storage_location_id: uuid.UUID
    destination_path: str | None
    transfer_adapter: TransferAdapterType
    status: TransferStatus
    bytes_transferred: int | None
    source_checksum: str | None
    dest_checksum: str | None
    checksum_verified: bool | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    prefect_flow_run_id: str | None

    model_config = {"from_attributes": True}
