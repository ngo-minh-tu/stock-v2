from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"

    db_path: str = "./data/screener.db"
    db_busy_timeout_ms: int = 5000

    jwt_secret: str = "change-me"
    jwt_ttl_hours: int = 24
    initial_user_email: str = "admin@local"
    initial_user_password: str = "ChangeMe123!"

    frontend_origin: str = "http://localhost:3000"

    vnstock_rate_limit_s: float = 0.5
    vnstock_timeout_s: int = 10

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    export_pdf_mode: str = "weasyprint"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
