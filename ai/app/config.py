from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "ai/.env"), extra="ignore")

    ai_internal_api_key: str = Field("", alias="AI_INTERNAL_API_KEY")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_base_url: str = Field(
        "https://generativelanguage.googleapis.com/v1beta/openai",
        alias="GEMINI_BASE_URL",
    )
    gemini_model: str = Field("gemini-3.8-flash", alias="GEMINI_MODEL")
    gemini_timeout_seconds: float = Field(
        40.0, gt=0, le=120, alias="GEMINI_TIMEOUT_SECONDS"
    )
    environment: str = Field("development", alias="ENVIRONMENT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
