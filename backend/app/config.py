from pydantic_settings import BaseSettings

from app.database import get_setting, save_setting


class Settings(BaseSettings):
    gemini_api_key: str = ""
    composio_api_key: str = ""
    host: str = "0.0.0.0"
    port: int = 8000
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> Settings:
    """Load settings, merging .env defaults with keys persisted in SQLite."""
    base = Settings()
    db_gemini = get_setting("gemini_api_key")
    db_composio = get_setting("composio_api_key")
    if db_gemini:
        base.gemini_api_key = db_gemini
    if db_composio:
        base.composio_api_key = db_composio
    return base


def save_settings(gemini_api_key: str = "", composio_api_key: str = "") -> None:
    """Persist API keys set via the UI to SQLite."""
    if gemini_api_key:
        save_setting("gemini_api_key", gemini_api_key)
    if composio_api_key:
        save_setting("composio_api_key", composio_api_key)


settings = get_settings()
