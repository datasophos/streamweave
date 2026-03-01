import base64

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "sqlite+aiosqlite:///./streamweave.db"

    # Auth
    secret_key: str = "change-me"
    jwt_lifetime_seconds: int = 3600
    # Set False only in development/testing environments where HTTPS is not enforced at the app level
    cookie_secure: bool = True
    # bcrypt work factor — lower in dev/test to avoid multi-second login delays inside Docker
    bcrypt_rounds: int = 12

    # Encryption
    streamweave_encryption_key: str = "change-me"

    @field_validator("streamweave_encryption_key")
    @classmethod
    def validate_fernet_key(cls, v: str) -> str:
        try:
            # translate urlsafe chars then decode with validate=True to reject non-base64 input
            decoded = base64.b64decode(v.replace("-", "+").replace("_", "/"), validate=True)
        except Exception as e:
            raise ValueError(
                "STREAMWEAVE_ENCRYPTION_KEY must be a valid url-safe base64-encoded string. "
                'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            ) from e
        if len(decoded) != 32:
            raise ValueError(
                f"STREAMWEAVE_ENCRYPTION_KEY must decode to exactly 32 bytes (got {len(decoded)}). "
                'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        return v

    # Prefect
    prefect_api_url: str = "http://localhost:4200/api"
    rclone_binary: str = "rclone"

    # SMTP / Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@streamweave.local"
    smtp_tls: bool = True
    smtp_enabled: bool = False

    # Persistent Identifiers
    ark_naan: str = "99999"
    ark_shoulder: str = "fk4"
    default_identifier_type: str = "ark"


settings = Settings()
