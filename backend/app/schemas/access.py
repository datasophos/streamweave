import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.access import GranteeType


class FileAccessGrantCreate(BaseModel):
    grantee_type: GranteeType
    grantee_id: uuid.UUID


class FileAccessGrantRead(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    grantee_type: GranteeType
    grantee_id: uuid.UUID
    granted_at: datetime

    model_config = {"from_attributes": True}
