import enum
import uuid

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin


class UserRole(enum.StrEnum):
    admin = "admin"
    user = "user"


class User(SQLAlchemyBaseUserTableUUID, SoftDeleteMixin, Base):
    __tablename__ = "users"

    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)


class UserInstrumentAccess(Base):
    __tablename__ = "user_instrument_access"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), primary_key=True)
