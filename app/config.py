from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Ratilal & Sons"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    DATABASE_URL: str
    DB_NAME: str
    ADMIN_USERNAME: str
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str

    BACKGROUND_TASK_INTERVAL_MINUTES: int = 15

    class Config:
        env_file = "app/.env"      # or ".env" if your env file is in project root
        case_sensitive = False

settings = Settings()

def get_settings() -> Settings:
    return settings
