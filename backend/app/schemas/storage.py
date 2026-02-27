import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, model_validator

from app.models.storage import StorageType

SENSITIVE_FIELDS: dict[str, list[str]] = {
    "s3": ["secret_access_key"],
    "cifs": ["password"],
}

MASKED = "****"


class S3Config(BaseModel):
    bucket: str
    region: str
    endpoint_url: str | None = None
    access_key_id: str
    secret_access_key: str


class CIFSConfig(BaseModel):
    host: str
    share: str
    domain: str | None = None
    username: str
    password: str


class NFSConfig(BaseModel):
    host: str
    export_path: str
    mount_options: str | None = None


_CONFIG_VALIDATORS: dict[str, type[BaseModel]] = {
    "s3": S3Config,
    "cifs": CIFSConfig,
    "nfs": NFSConfig,
}


def validate_connection_config(storage_type: StorageType, config: dict | None) -> dict | None:
    """Validate that connection_config has all required fields for the given type.

    Returns the validated config dict (fields coerced by the sub-schema).
    Raises ValidationError if config is invalid.
    """
    validator = _CONFIG_VALIDATORS.get(storage_type)
    if validator is None:
        # posix — no connection_config needed
        return config
    if config is None:
        config = {}
    parsed = validator.model_validate(config)
    return parsed.model_dump(exclude_none=False)


def mask_sensitive(storage_type: StorageType, config: dict | None) -> dict | None:
    """Replace sensitive field values with MASKED so they are not returned in API responses."""
    if config is None:
        return None
    sensitive = SENSITIVE_FIELDS.get(storage_type, [])
    if not sensitive:
        return config
    return {k: (MASKED if k in sensitive else v) for k, v in config.items()}


class StorageLocationCreate(BaseModel):
    name: str
    type: StorageType
    connection_config: dict | None = None
    base_path: str
    enabled: bool = True

    @model_validator(mode="after")
    def validate_config_for_type(self) -> "StorageLocationCreate":
        self.connection_config = validate_connection_config(self.type, self.connection_config)
        return self


class StorageLocationRead(BaseModel):
    id: uuid.UUID
    name: str
    type: StorageType
    connection_config: dict | None
    base_path: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class StorageLocationUpdate(BaseModel):
    name: str | None = None
    type: StorageType | None = None
    connection_config: dict | None = None
    base_path: str | None = None
    enabled: bool | None = None

    @model_validator(mode="after")
    def validate_config_for_type(self) -> "StorageLocationUpdate":
        if self.type is not None and self.connection_config is not None:
            self.connection_config = validate_connection_config(self.type, self.connection_config)
        return self


# Annotated alias used by test-connection endpoint
StorageTestResponse = Annotated[dict, None]
