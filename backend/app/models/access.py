import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey


class GranteeType(str, enum.Enum):
    user = "user"
    group = "group"
    project = "project"


class FileAccessGrant(UUIDPrimaryKey, Base):
    __tablename__ = "file_access_grants"

    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE")
    )
    grantee_type: Mapped[GranteeType] = mapped_column(Enum(GranteeType))
    grantee_id: Mapped[uuid.UUID] = mapped_column()
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    file: Mapped["FileRecord"] = relationship(back_populates="access_grants")  # noqa: F821
