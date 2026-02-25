import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey
from app.models.instrument import TransferAdapterType


class TransferStatus(enum.StrEnum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class FileTransfer(UUIDPrimaryKey, Base):
    __tablename__ = "file_transfers"

    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_records.id"))
    storage_location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("storage_locations.id"))
    destination_path: Mapped[str | None] = mapped_column(String(2048))
    transfer_adapter: Mapped[TransferAdapterType] = mapped_column(Enum(TransferAdapterType))
    status: Mapped[TransferStatus] = mapped_column(
        Enum(TransferStatus), default=TransferStatus.pending
    )
    bytes_transferred: Mapped[int | None] = mapped_column(BigInteger)
    source_checksum: Mapped[str | None] = mapped_column(String(128))
    dest_checksum: Mapped[str | None] = mapped_column(String(128))
    checksum_verified: Mapped[bool | None] = mapped_column(Boolean)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    prefect_flow_run_id: Mapped[str | None] = mapped_column(String(255))

    file: Mapped["FileRecord"] = relationship(back_populates="transfers")  # noqa: F821
    storage_location: Mapped["StorageLocation"] = relationship()  # noqa: F821
