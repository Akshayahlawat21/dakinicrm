from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "ai/.env"), extra="ignore")

    ai_internal_api_key: str = Field("", alias="AI_INTERNAL_API_KEY")
    llm_api_key: str = Field("", alias="LLM_API_KEY")
    llm_base_url: str = Field("https://api.openai.com/v1", alias="LLM_BASE_URL")
    llm_model: str = Field("gpt-4o-mini", alias="LLM_MODEL")
    llm_timeout_seconds: float = Field(40.0, gt=0, le=120, alias="LLM_TIMEOUT_SECONDS")
    environment: str = Field("development", alias="ENVIRONMENT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
