import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class HarvestSchedule(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "harvest_schedules"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"))
    default_storage_location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("storage_locations.id")
    )
    cron_expression: Mapped[str] = mapped_column(String(100))
    prefect_deployment_id: Mapped[str | None] = mapped_column(String(255))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    instrument: Mapped["Instrument"] = relationship(back_populates="schedules")  # noqa: F821
    default_storage_location: Mapped["StorageLocation"] = relationship()  # noqa: F821
