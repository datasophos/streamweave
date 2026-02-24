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

    # Encryption
    streamweave_encryption_key: str = "change-me"

    # Persistent Identifiers
    ark_naan: str = "99999"
    ark_shoulder: str = "fk4"
    default_identifier_type: str = "ark"


settings = Settings()
