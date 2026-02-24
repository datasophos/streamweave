import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey


class HookTrigger(str, enum.Enum):
    pre_transfer = "pre_transfer"
    post_transfer = "post_transfer"


class HookImplementation(str, enum.Enum):
    builtin = "builtin"
    python_script = "python_script"
    http_webhook = "http_webhook"


class HookConfig(UUIDPrimaryKey, Base):
    __tablename__ = "hook_configs"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    trigger: Mapped[HookTrigger] = mapped_column(Enum(HookTrigger))
    implementation: Mapped[HookImplementation] = mapped_column(Enum(HookImplementation))
    builtin_name: Mapped[str | None] = mapped_column(String(255))
    script_path: Mapped[str | None] = mapped_column(String(1024))
    webhook_url: Mapped[str | None] = mapped_column(String(2048))
    config: Mapped[dict | None] = mapped_column(JSON)
    instrument_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("instruments.id"))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    instrument: Mapped["Instrument | None"] = relationship(back_populates="hooks")  # noqa: F821
