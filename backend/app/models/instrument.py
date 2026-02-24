import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class TransferAdapterType(str, enum.Enum):
    rclone = "rclone"
    globus = "globus"
    rsync = "rsync"


class ServiceAccount(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "service_accounts"

    name: Mapped[str] = mapped_column(String(255))
    domain: Mapped[str | None] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(255))
    password_encrypted: Mapped[str] = mapped_column(Text)

    instruments: Mapped[list["Instrument"]] = relationship(back_populates="service_account")


class Instrument(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "instruments"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    pid: Mapped[str | None] = mapped_column(String(255))

    cifs_host: Mapped[str] = mapped_column(String(255))
    cifs_share: Mapped[str] = mapped_column(String(255))
    cifs_base_path: Mapped[str | None] = mapped_column(String(1024))

    service_account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("service_accounts.id")
    )
    transfer_adapter: Mapped[TransferAdapterType] = mapped_column(
        Enum(TransferAdapterType), default=TransferAdapterType.rclone
    )
    transfer_config: Mapped[dict | None] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    service_account: Mapped[ServiceAccount | None] = relationship(
        back_populates="instruments"
    )
    schedules: Mapped[list["HarvestSchedule"]] = relationship(  # noqa: F821
        back_populates="instrument"
    )
    files: Mapped[list["FileRecord"]] = relationship(back_populates="instrument")  # noqa: F821
    hooks: Mapped[list["HookConfig"]] = relationship(back_populates="instrument")  # noqa: F821
