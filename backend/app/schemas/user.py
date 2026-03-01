import uuid
from datetime import datetime

from fastapi_users import schemas

from app.models.user import UserRole
from app.schemas.group import GroupRead
from app.schemas.project import ProjectRead


class UserRead(schemas.BaseUser[uuid.UUID]):
    role: UserRole
    deleted_at: datetime | None = None


class UserMeRead(UserRead):
    groups: list[GroupRead]
    projects: list[ProjectRead]


class UserCreate(schemas.BaseUserCreate):
    role: UserRole = UserRole.user


class UserUpdate(schemas.BaseUserUpdate):
    role: UserRole | None = None
