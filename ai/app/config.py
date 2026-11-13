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
    # Flash-Lite is the latency-first default for short CRM tool selection and answers.
    gemini_model: str = Field("gemini-3.1-flash-lite", alias="GEMINI_MODEL")
    # Fallback is intentionally disabled: the deployment is Gemini-only and
    # model switching cannot solve a project-wide exhausted daily quota.
    gemini_fallback_models: str = Field("", alias="GEMINI_FALLBACK_MODELS")
    # Per-request timeout for the single configured Gemini model.
    gemini_timeout_seconds: float = Field(
        12.0, gt=0, le=60, alias="GEMINI_TIMEOUT_SECONDS"
    )

    @property
    def gemini_model_chain(self) -> list[str]:
        # Compatibility for callers/tests: only the configured model is used.
        return [self.gemini_model]
    environment: str = Field("development", alias="ENVIRONMENT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
