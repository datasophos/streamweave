from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.instrument import Instrument
    from app.models.storage import StorageLocation


class HarvestSchedule(UUIDPrimaryKey, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "harvest_schedules"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"))
    default_storage_location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("storage_locations.id")
    )
    cron_expression: Mapped[str] = mapped_column(String(100))
    prefect_deployment_id: Mapped[str | None] = mapped_column(String(255))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    instrument: Mapped[Instrument] = relationship(back_populates="schedules")
    default_storage_location: Mapped[StorageLocation] = relationship()
