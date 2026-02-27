import uuid
from datetime import datetime

from fastapi_users import schemas

from app.models.user import UserRole


class UserRead(schemas.BaseUser[uuid.UUID]):
    role: UserRole
    deleted_at: datetime | None = None


class UserCreate(schemas.BaseUserCreate):
    role: UserRole = UserRole.user


class UserUpdate(schemas.BaseUserUpdate):
    role: UserRole | None = None
