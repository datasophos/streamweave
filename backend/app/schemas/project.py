import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.project import MemberType


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectMemberAdd(BaseModel):
    member_type: MemberType
    member_id: uuid.UUID


class ProjectMemberRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    member_type: MemberType
    member_id: uuid.UUID

    model_config = {"from_attributes": True}


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
