import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey


class PersistentIdType(str, enum.Enum):
    ark = "ark"
    doi = "doi"
    handle = "handle"


class FileRecord(UUIDPrimaryKey, Base):
    __tablename__ = "file_records"
    __table_args__ = (
        Index("ix_file_records_instrument_source", "instrument_id", "source_path", unique=True),
    )

    persistent_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    persistent_id_type: Mapped[PersistentIdType] = mapped_column(Enum(PersistentIdType))

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"))
    source_path: Mapped[str] = mapped_column(String(2048))
    filename: Mapped[str] = mapped_column(String(512))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    source_mtime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    xxhash: Mapped[str | None] = mapped_column(String(64))
    sha256: Mapped[str | None] = mapped_column(String(64))
    first_discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    instrument: Mapped["Instrument"] = relationship(back_populates="files")  # noqa: F821
    transfers: Mapped[list["FileTransfer"]] = relationship(  # noqa: F821
        back_populates="file"
    )
    access_grants: Mapped[list["FileAccessGrant"]] = relationship(  # noqa: F821
        back_populates="file", cascade="all, delete-orphan"
    )
