from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.file import FileRecord
    from app.models.hook import HookConfig
    from app.models.schedule import HarvestSchedule


class TransferAdapterType(enum.StrEnum):
    rclone = "rclone"
    globus = "globus"
    rsync = "rsync"


class ServiceAccount(UUIDPrimaryKey, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "service_accounts"

    name: Mapped[str] = mapped_column(String(255))
    domain: Mapped[str | None] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(255))
    password_encrypted: Mapped[str] = mapped_column(Text)

    instruments: Mapped[list[Instrument]] = relationship(back_populates="service_account")


class Instrument(UUIDPrimaryKey, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "instruments"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    pid: Mapped[str | None] = mapped_column(String(255))

    cifs_host: Mapped[str] = mapped_column(String(255))
    cifs_share: Mapped[str] = mapped_column(String(255))
    cifs_base_path: Mapped[str | None] = mapped_column(String(1024))

    service_account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("service_accounts.id"))
    transfer_adapter: Mapped[TransferAdapterType] = mapped_column(
        Enum(TransferAdapterType), default=TransferAdapterType.rclone
    )
    transfer_config: Mapped[dict | None] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    service_account: Mapped[ServiceAccount | None] = relationship(back_populates="instruments")
    schedules: Mapped[list[HarvestSchedule]] = relationship(back_populates="instrument")
    files: Mapped[list[FileRecord]] = relationship(back_populates="instrument")
    hooks: Mapped[list[HookConfig]] = relationship(back_populates="instrument")
