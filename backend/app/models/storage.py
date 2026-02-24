import enum

from sqlalchemy import Boolean, Enum, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class StorageType(str, enum.Enum):
    posix = "posix"
    s3 = "s3"
    cifs = "cifs"
    nfs = "nfs"


class StorageLocation(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "storage_locations"

    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[StorageType] = mapped_column(Enum(StorageType))
    connection_config: Mapped[dict | None] = mapped_column(JSON)
    base_path: Mapped[str] = mapped_column(String(1024))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
