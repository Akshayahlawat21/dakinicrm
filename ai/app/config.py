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
    # Default model: gemini-2.5-flash is stable, fast and low-latency.
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    # Automatic fallback models in case the configured model returns 404/unavailable.
    gemini_fallback_models: str = Field("gemini-1.5-flash,gemini-2.0-flash", alias="GEMINI_FALLBACK_MODELS")
    # Per-request timeout for Gemini calls (in seconds).
    gemini_timeout_seconds: float = Field(
        35.0, gt=0, le=90, alias="GEMINI_TIMEOUT_SECONDS"
    )

    @property
    def gemini_model_chain(self) -> list[str]:
        chain = [self.gemini_model.strip()] if self.gemini_model else []
        if self.gemini_fallback_models:
            for m in self.gemini_fallback_models.split(","):
                m_clean = m.strip()
                if m_clean and m_clean not in chain:
                    chain.append(m_clean)
        return chain or ["gemini-2.5-flash"]
    environment: str = Field("development", alias="ENVIRONMENT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
