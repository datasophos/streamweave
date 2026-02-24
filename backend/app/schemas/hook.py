import uuid

from pydantic import BaseModel

from app.models.hook import HookImplementation, HookTrigger


class HookConfigCreate(BaseModel):
    name: str
    description: str | None = None
    trigger: HookTrigger
    implementation: HookImplementation
    builtin_name: str | None = None
    script_path: str | None = None
    webhook_url: str | None = None
    config: dict | None = None
    instrument_id: uuid.UUID | None = None
    priority: int = 0
    enabled: bool = True


class HookConfigRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    trigger: HookTrigger
    implementation: HookImplementation
    builtin_name: str | None
    script_path: str | None
    webhook_url: str | None
    config: dict | None
    instrument_id: uuid.UUID | None
    priority: int
    enabled: bool

    model_config = {"from_attributes": True}


class HookConfigUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger: HookTrigger | None = None
    implementation: HookImplementation | None = None
    builtin_name: str | None = None
    script_path: str | None = None
    webhook_url: str | None = None
    config: dict | None = None
    instrument_id: uuid.UUID | None = None
    priority: int | None = None
    enabled: bool | None = None
